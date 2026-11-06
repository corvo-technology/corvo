import type { Pool, PoolClient } from "pg";

/** A number's socket may be held by one process at a time. */
export type AcquireNumberLock = (
  installationId: string,
) => Promise<(() => Promise<void>) | undefined>;

// Two keys give this lock its own namespace next to the reconciler's.
const NAMESPACE = 1_380_019_076;

/**
 * Takes a Postgres session advisory lock per number, on a connection kept for as long as the
 * socket is held. A process that dies loses the connection and so the lock, which lets another
 * process take the number on its next attempt.
 */
export function createPostgresNumberLock(pool: Pick<Pool, "connect">): AcquireNumberLock {
  return async (installationId) => {
    const client: PoolClient = await pool.connect();
    try {
      const result = await client.query<{ acquired: boolean }>(
        "SELECT pg_try_advisory_lock($1::integer, hashtext($2)) AS acquired",
        [NAMESPACE, installationId],
      );
      if (!result.rows[0]?.acquired) {
        client.release();
        return undefined;
      }
    } catch (error) {
      client.release(true);
      throw error;
    }
    return async () => {
      let destroy = false;
      try {
        const result = await client.query<{ released: boolean }>(
          "SELECT pg_advisory_unlock($1::integer, hashtext($2)) AS released",
          [NAMESPACE, installationId],
        );
        destroy = result.rows[0]?.released !== true;
      } catch {
        destroy = true;
      } finally {
        client.release(destroy);
      }
    };
  };
}
