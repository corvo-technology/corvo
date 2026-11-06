import { describe, expect, it, vi } from "vitest";
import { createInProcessNumberLock, createPostgresNumberLock } from "./number-lock.js";

function fakePool(grant: boolean) {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const release = vi.fn();
  const client = {
    query: async (sql: string, values: unknown[]) => {
      queries.push({ sql, values });
      return { rows: [{ acquired: grant, released: true }] };
    },
    release,
    once: vi.fn(),
    removeListener: vi.fn(),
  };
  return { pool: { connect: async () => client }, queries, release };
}

describe("createPostgresNumberLock", () => {
  it("returns a release function when the lock is granted, and unlocks the same key", async () => {
    const { pool, queries, release } = fakePool(true);
    const held = await createPostgresNumberLock(pool as never)("inst-1");
    expect(held).toBeTypeOf("function");
    await held?.();
    expect(queries[0]?.sql).toContain("pg_try_advisory_lock");
    expect(queries[1]?.sql).toContain("pg_advisory_unlock");
    expect(queries[1]?.values).toEqual(queries[0]?.values);
    expect(release).toHaveBeenCalled();
  });

  it("returns undefined and gives the connection back when another process holds it", async () => {
    const { pool, release } = fakePool(false);
    expect(await createPostgresNumberLock(pool as never)("inst-1")).toBeUndefined();
    expect(release).toHaveBeenCalled();
  });
});

describe("createInProcessNumberLock", () => {
  it("grants a number once until it is released", async () => {
    const acquire = createInProcessNumberLock();
    const first = await acquire("inst-1");
    expect(first).toBeTypeOf("function");
    expect(await acquire("inst-1")).toBeUndefined();
    expect(await acquire("inst-2")).toBeTypeOf("function");
    await first?.();
    expect(await acquire("inst-1")).toBeTypeOf("function");
  });
});
