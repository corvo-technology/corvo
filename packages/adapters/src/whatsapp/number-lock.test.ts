import { describe, expect, it, vi } from "vitest";
import { createInProcessNumberLock, createPostgresNumberLock } from "./number-lock.js";

/** A pool whose one connection grants or refuses locks, and can die. */
function fakePool(grant: (id: string) => boolean = () => true) {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const listeners = new Map<string, () => void>();
  const release = vi.fn();
  const client = {
    query: async (sql: string, values: unknown[]) => {
      queries.push({ sql, values });
      return { rows: [{ acquired: grant(String(values[1])), released: true }] };
    },
    release,
    once: (event: string, handler: () => void) => void listeners.set(event, handler),
    removeListener: vi.fn(),
  };
  const connect = vi.fn(async () => client);
  return { pool: { connect }, queries, release, connect, die: () => listeners.get("error")?.() };
}

describe("createPostgresNumberLock", () => {
  it("returns a release function when granted, and unlocks the same key", async () => {
    const { pool, queries } = fakePool();
    const held = await createPostgresNumberLock(pool as never)("inst-1");
    expect(held).toBeTypeOf("function");
    await held?.();
    expect(queries[0]?.sql).toContain("pg_try_advisory_lock");
    expect(queries[1]?.sql).toContain("pg_advisory_unlock");
    expect(queries[1]?.values).toEqual(queries[0]?.values);
  });

  it("returns undefined when another process holds the number", async () => {
    const { pool } = fakePool(() => false);
    expect(await createPostgresNumberLock(pool as never)("inst-1")).toBeUndefined();
  });

  it("holds every number on one connection, so a thousand numbers cost one", async () => {
    const { pool, connect } = fakePool();
    const acquire = createPostgresNumberLock(pool as never);
    await acquire("inst-1");
    await acquire("inst-2");
    await acquire("inst-3");
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("tells every holder when the connection dies, and takes a new one for the next lock", async () => {
    const { pool, connect, die } = fakePool();
    const acquire = createPostgresNumberLock(pool as never);
    const lost: string[] = [];
    await acquire("inst-1", () => lost.push("inst-1"));
    await acquire("inst-2", () => lost.push("inst-2"));
    die();
    expect(lost.sort()).toEqual(["inst-1", "inst-2"]);
    await acquire("inst-1");
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it("does not tell a holder that already released", async () => {
    const { pool, die } = fakePool();
    const acquire = createPostgresNumberLock(pool as never);
    const lost = vi.fn();
    const release = await acquire("inst-1", lost);
    await release?.();
    die();
    expect(lost).not.toHaveBeenCalled();
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
