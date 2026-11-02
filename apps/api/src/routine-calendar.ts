import type { Actor, RoutineCalendar, RoutineOccurrence } from "@corvo/contracts";
import { ROUTINE_CALENDAR_MAX_DAYS, ROUTINE_CALENDAR_MAX_ITEMS } from "@corvo/contracts";
import { isOneShotRoutineCrons, nextCronDateAcrossStrict } from "@corvo/core";
import type { PrismaClient } from "@corvo/db";
import { ORPCError } from "@orpc/server";

const DAY_MS = 24 * 60 * 60_000;

/**
 * Every routine of the space laid out in time. Runs that already happened come from the run
 * itself, so a failure shows as one; runs still to come are worked out from each active
 * schedule. A change trigger polls, so it has no fixed times to show.
 */
export async function routineCalendar(
  prisma: PrismaClient,
  actor: Actor,
  range: { from: Date; to: Date },
  now = new Date(),
): Promise<RoutineCalendar> {
  const { from, to } = range;
  if (!(from < to) || to.getTime() - from.getTime() > ROUTINE_CALENDAR_MAX_DAYS * DAY_MS) {
    throw new ORPCError("BAD_REQUEST", { message: "Choose a shorter span." });
  }

  const routines = await prisma.routine.findMany({
    where: { spaceId: actor.spaceId, bot: { archivedAt: null } },
    select: {
      id: true,
      name: true,
      botId: true,
      active: true,
      crons: true,
      timezone: true,
      nextRunAt: true,
      watch: true,
      bot: { select: { name: true } },
    },
  });
  if (routines.length === 0) return { occurrences: [], truncated: false };
  const byId = new Map(routines.map((routine) => [routine.id, routine]));

  const occurrences: RoutineOccurrence[] = [];
  const pastEnd = to < now ? to : now;
  if (from < pastEnd) {
    const runs = await prisma.run.findMany({
      where: {
        spaceId: actor.spaceId,
        routineId: { in: [...byId.keys()] },
        trigger: "routine",
        createdAt: { gte: from, lt: pastEnd },
      },
      select: { id: true, routineId: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: ROUTINE_CALENDAR_MAX_ITEMS + 1,
    });
    for (const run of runs) {
      const routine = run.routineId ? byId.get(run.routineId) : undefined;
      if (!routine) continue;
      occurrences.push({
        routineId: routine.id,
        name: routine.name,
        botId: routine.botId,
        botName: routine.bot.name,
        at: run.createdAt.toISOString(),
        state: runState(run.status),
        runId: run.id,
      });
    }
  }

  const futureStart = from > now ? from : now;
  for (const routine of routines) {
    if (!routine.active || routine.watch != null || !routine.nextRunAt) continue;
    for (const at of upcomingTimes(routine, futureStart, to)) {
      occurrences.push({
        routineId: routine.id,
        name: routine.name,
        botId: routine.botId,
        botName: routine.bot.name,
        at: at.toISOString(),
        state: "upcoming",
        runId: null,
      });
    }
  }

  occurrences.sort((a, b) => a.at.localeCompare(b.at) || a.routineId.localeCompare(b.routineId));
  const truncated = occurrences.length > ROUTINE_CALENDAR_MAX_ITEMS;
  return { occurrences: occurrences.slice(0, ROUTINE_CALENDAR_MAX_ITEMS), truncated };
}

export function runState(status: string): Exclude<RoutineOccurrence["state"], "upcoming"> {
  if (status === "completed") return "done";
  if (status === "failed" || status === "cancelled") return "failed";
  return "running";
}

function upcomingTimes(
  routine: { crons: string[]; timezone: string; nextRunAt: Date | null },
  from: Date,
  to: Date,
): Date[] {
  const times: Date[] = [];
  if (isOneShotRoutineCrons(routine.crons)) {
    const at = routine.nextRunAt;
    if (at && at >= from && at < to) times.push(at);
    return times;
  }
  let cursor = from;
  while (times.length <= ROUTINE_CALENDAR_MAX_ITEMS) {
    let next: Date | null;
    try {
      next = nextCronDateAcrossStrict(routine.crons, cursor, routine.timezone);
    } catch {
      return times;
    }
    if (!next || next >= to || next <= cursor) return times;
    times.push(next);
    cursor = next;
  }
  return times;
}
