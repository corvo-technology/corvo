import type { Actor } from "@corvo/contracts";
import type { PrismaClient } from "@corvo/db";
import { describe, expect, it } from "vitest";
import { routineCalendar } from "./routine-calendar.js";

const actor = { spaceId: "space-1", userId: "user-1" } as Actor;
const now = new Date("2026-10-29T12:00:00Z");

function routine(over: Record<string, unknown> = {}) {
  return {
    id: "r1",
    name: "Morning summary",
    botId: "b1",
    active: true,
    crons: ["0 9 * * *"],
    timezone: "UTC",
    nextRunAt: new Date("2026-10-30T09:00:00Z"),
    watch: null,
    bot: { name: "Chief" },
    ...over,
  };
}

function db(routines: unknown[], runs: unknown[] = []) {
  return {
    routine: { findMany: async () => routines },
    run: { findMany: async () => runs },
  } as unknown as PrismaClient;
}

const span = (from: string, to: string) => ({ from: new Date(from), to: new Date(to) });

describe("routineCalendar", () => {
  it("lays out the runs still to come from each active schedule", async () => {
    const calendar = await routineCalendar(
      db([routine()]),
      actor,
      span("2026-10-29T00:00:00Z", "2026-11-02T00:00:00Z"),
      now,
    );
    expect(calendar.occurrences.map((item) => [item.at, item.state])).toEqual([
      ["2026-10-30T09:00:00.000Z", "upcoming"],
      ["2026-10-31T09:00:00.000Z", "upcoming"],
      ["2026-11-01T09:00:00.000Z", "upcoming"],
    ]);
    expect(calendar.occurrences[0]).toMatchObject({ name: "Morning summary", botName: "Chief" });
  });

  it("shows runs that already happened by how they ended, and none still to come before now", async () => {
    const runs = [
      {
        id: "run-1",
        routineId: "r1",
        status: "completed",
        createdAt: new Date("2026-10-28T09:00:00Z"),
      },
      {
        id: "run-2",
        routineId: "r1",
        status: "failed",
        createdAt: new Date("2026-10-29T09:00:00Z"),
      },
      {
        id: "run-3",
        routineId: "r1",
        status: "running",
        createdAt: new Date("2026-10-29T11:59:00Z"),
      },
    ];
    const calendar = await routineCalendar(
      db([routine()], runs),
      actor,
      span("2026-10-28T00:00:00Z", "2026-10-30T12:00:00Z"),
      now,
    );
    expect(calendar.occurrences.map((item) => item.state)).toEqual([
      "done",
      "failed",
      "running",
      "upcoming",
    ]);
    expect(calendar.occurrences[1]).toMatchObject({ runId: "run-2" });
  });

  it("leaves out paused routines and change triggers, which have no fixed times", async () => {
    const calendar = await routineCalendar(
      db([routine({ active: false }), routine({ id: "r2", watch: { url: "https://x.test" } })]),
      actor,
      span("2026-10-29T00:00:00Z", "2026-11-02T00:00:00Z"),
      now,
    );
    expect(calendar.occurrences).toEqual([]);
  });

  it("shows a one-time routine once, at its time", async () => {
    const calendar = await routineCalendar(
      db([routine({ crons: ["@once"], nextRunAt: new Date("2026-10-31T15:30:00Z") })]),
      actor,
      span("2026-10-29T00:00:00Z", "2026-11-02T00:00:00Z"),
      now,
    );
    expect(calendar.occurrences.map((item) => item.at)).toEqual(["2026-10-31T15:30:00.000Z"]);
  });

  it("follows the routine's own time zone", async () => {
    const calendar = await routineCalendar(
      db([routine({ timezone: "America/Sao_Paulo" })]),
      actor,
      span("2026-10-30T00:00:00Z", "2026-10-31T00:00:00Z"),
      now,
    );
    // 09:00 in São Paulo (UTC-3) is 12:00 UTC.
    expect(calendar.occurrences.map((item) => item.at)).toEqual(["2026-10-30T12:00:00.000Z"]);
  });

  it("caps a very frequent schedule and says so", async () => {
    const calendar = await routineCalendar(
      db([routine({ crons: ["* * * * *"] })]),
      actor,
      span("2026-10-29T12:00:00Z", "2026-11-05T12:00:00Z"),
      now,
    );
    expect(calendar.occurrences).toHaveLength(600);
    expect(calendar.truncated).toBe(true);
  });

  it("refuses an empty, reversed or oversized span", async () => {
    for (const [from, to] of [
      ["2026-10-30T00:00:00Z", "2026-10-30T00:00:00Z"],
      ["2026-10-30T00:00:00Z", "2026-10-29T00:00:00Z"],
      ["2026-10-01T00:00:00Z", "2026-12-31T00:00:00Z"],
    ]) {
      await expect(
        routineCalendar(db([routine()]), actor, span(from!, to!), now),
      ).rejects.toThrow();
    }
  });
});
