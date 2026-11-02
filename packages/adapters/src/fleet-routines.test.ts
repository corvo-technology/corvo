import type { PrismaClient } from "@corvo/db";
import { describe, expect, it, vi } from "vitest";
import { listRoutines } from "./fleet-routines.js";

const run = {
  spaceId: "space-1",
  userId: "user-1",
  botId: "chief",
  groupId: null,
  threadId: "t1",
  runId: "run-1",
};

function routine(over: Record<string, unknown> = {}) {
  return {
    id: "r1",
    name: "Morning summary",
    crons: ["0 9 * * *"],
    timezone: "America/Sao_Paulo",
    active: true,
    nextRunAt: new Date("2026-10-30T12:00:00Z"),
    lastRunAt: new Date("2026-10-29T12:00:00Z"),
    watch: null,
    webhookEnabled: false,
    githubEnabled: false,
    bot: { id: "b1", name: "Analyst" },
    ...over,
  };
}

function db(routines: unknown[], runs: unknown[] = []) {
  const findRoutines = vi.fn(async () => routines);
  return {
    prisma: {
      routine: { findMany: findRoutines },
      run: { findMany: vi.fn(async () => runs) },
    } as unknown as PrismaClient,
    findRoutines,
  };
}

describe("listRoutines", () => {
  it("tells each routine's agent, timing and how its last run ended", async () => {
    const { prisma } = db(
      [routine(), routine({ id: "r2", name: "Report", active: false, nextRunAt: null })],
      [{ routineId: "r1", status: "failed" }],
    );
    const listing = await listRoutines({ prisma }, run);
    expect(listing.routines[0]).toMatchObject({
      routine_id: "r1",
      agent: "Analyst",
      name: "Morning summary",
      active: true,
      next_run: "2026-10-30T12:00:00.000Z",
      last_result: "failed",
    });
    expect(listing.routines[0]!.schedule).toMatch(/9/);
    expect(listing.routines[1]).toMatchObject({ active: false, next_run: null, last_result: null });
    expect(listing.truncated).toBe(false);
  });

  it("describes routines that have no times", async () => {
    const { prisma } = db([
      routine({ crons: [], watch: { url: "https://example.test" } }),
      routine({ id: "r2", crons: [], webhookEnabled: true }),
    ]);
    const { routines } = await listRoutines({ prisma }, run);
    expect(routines.map((item) => item.schedule)).toEqual([
      "when something changes",
      "when triggered from outside",
    ]);
  });

  it("only reads this space's routines of agents the caller manages", async () => {
    const { prisma, findRoutines } = db([]);
    await listRoutines({ prisma }, run);
    expect(findRoutines).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          spaceId: "space-1",
          bot: expect.objectContaining({ archivedAt: null }),
        }),
      }),
    );
  });

  it("says when the list was cut", async () => {
    const many = Array.from({ length: 51 }, (_, index) => routine({ id: `r${index}` }));
    const { prisma } = db(many);
    const listing = await listRoutines({ prisma }, run);
    expect(listing.routines).toHaveLength(50);
    expect(listing.truncated).toBe(true);
  });
});
