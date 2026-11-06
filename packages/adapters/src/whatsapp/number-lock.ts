import type { Pool, PoolClient } from "pg";

/**
 * A number's socket may be held by one process at a time. `onLost` runs if the lock is lost
 * without the holder releasing it (the connection that held it died).
 */
export type AcquireNumberLock = (
  installationId: string,
  onLost?: () => void,
) => Promise<(() => Promise<void>) | undefined>;

// Two keys give this lock its own namespace next to the reconciler's.
const NAMESPACE = 1_380_019_076;

/**
 * Takes a Postgres session advisory lock per number. Every number is locked on ONE connection,
 * so any number of linked numbers costs a single database connection, and a process that dies
 * loses that connection and so all its locks, which lets another process take the numbers. If
 * the connection dies under a living process, each holder is told so it can stop its socket.
 */
export function createPostgresNumberLock(pool: Pick<Pool, "connect">): AcquireNumberLock {
  let session: Promise<PoolClient> | undefined;
  const holders = new Map<string, () => void>();

  const connect = (): Promise<PoolClient> => {
    session ??= pool.connect().then((client) => {
      const lose = () => {
        if (!session) return;
        session = undefined;
        const lost = [...holders.values()];
        holders.clear();
        // The connection is in an unknown state: never return it to the pool.
        try {
          client.release(true);
        } catch {
          // Already gone.
        }
        for (const notify of lost) notify();
      };
      client.once("error", lose);
      client.once("end", lose);
      return client;
    });
    session.catch(() => {
      session = undefined;
    });
    return session;
  };

  return async (installationId, onLost) => {
    const client = await connect();
    const result = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1::integer, hashtext($2)) AS acquired",
      [NAMESPACE, installationId],
    );
    if (!result.rows[0]?.acquired) return undefined;
    holders.set(installationId, onLost ?? (() => undefined));
    return async () => {
      holders.delete(installationId);
      try {
        await client.query("SELECT pg_advisory_unlock($1::integer, hashtext($2)) AS released", [
          NAMESPACE,
          installationId,
        ]);
      } catch {
        // A lost connection has dropped the lock already.
      }
    };
  };
}

/**
 * For a process with no shared database to lock through (tests, a single-process setup): one
 * process is the only holder there is, so the lock only guards against taking a number twice.
 */
export function createInProcessNumberLock(): AcquireNumberLock {
  const held = new Set<string>();
  return async (installationId) => {
    if (held.has(installationId)) return undefined;
    held.add(installationId);
    return async () => {
      held.delete(installationId);
    };
  };
}
