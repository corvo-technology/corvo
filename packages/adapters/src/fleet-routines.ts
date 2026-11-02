import { formatCron } from "@corvo/core";
import type { PrismaClient } from "@corvo/db";
import { managedBotsWhere } from "./child-bots.js";
import type { FleetRun } from "./fleet-tools.js";

const ROUTINE_LIMIT = 50;

export interface RoutineListing {
  routines: Array<{
    routine_id: string;
    agent: string;
    agent_id: string;
    name: string;
    schedule: string;
    timezone: string;
    active: boolean;
    next_run: string | null;
    last_run: string | null;
    last_result: string | null;
  }>;
  truncated: boolean;
}

/**
 * Every routine of the agents this one manages, so the owner can be told what is scheduled and
 * how the last run went without opening each agent. Read-only.
 */
export async function listRoutines(
  deps: { prisma: PrismaClient },
  run: FleetRun,
): Promise<RoutineListing> {
  const rows = await deps.prisma.routine.findMany({
    where: {
      spaceId: run.spaceId,
      bot: { ...managedBotsWhere(run), archivedAt: null },
    },
    select: {
      id: true,
      name: true,
      crons: true,
      timezone: true,
      active: true,
      nextRunAt: true,
      lastRunAt: true,
      watch: true,
      webhookEnabled: true,
      githubEnabled: true,
      bot: { select: { id: true, name: true } },
    },
    orderBy: [{ active: "desc" }, { nextRunAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
    take: ROUTINE_LIMIT + 1,
  });
  const shown = rows.slice(0, ROUTINE_LIMIT);
  const lastRuns = shown.length
    ? await deps.prisma.run.findMany({
        where: { routineId: { in: shown.map((row) => row.id) }, trigger: "routine" },
        select: { routineId: true, status: true },
        orderBy: [{ routineId: "asc" }, { createdAt: "desc" }],
        distinct: ["routineId"],
      })
    : [];
  const resultByRoutine = new Map(lastRuns.map((last) => [last.routineId, last.status]));
  return {
    routines: shown.map((row) => ({
      routine_id: row.id,
      agent: row.bot.name,
      agent_id: row.bot.id,
      name: row.name,
      schedule: row.watch
        ? "when something changes"
        : row.crons.length > 0
          ? row.crons.map((cron) => formatCron(cron)).join("; ")
          : row.webhookEnabled || row.githubEnabled
            ? "when triggered from outside"
            : "none",
      timezone: row.timezone,
      active: row.active,
      next_run: row.nextRunAt?.toISOString() ?? null,
      last_run: row.lastRunAt?.toISOString() ?? null,
      last_result: resultByRoutine.get(row.id) ?? null,
    })),
    truncated: rows.length > ROUTINE_LIMIT,
  };
}
