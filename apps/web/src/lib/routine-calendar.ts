import type { RoutineOccurrence } from "@corvo/contracts";

export type CalendarView = "day" | "week" | "month";

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
/** Monday is the first day of the week. */
const startOfWeek = (date: Date) => addDays(startOfDay(date), -((date.getDay() + 6) % 7));

export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

/** The days a view shows, in the viewer's own time. A month is six full weeks, so it always fits one query. */
export function visibleDays(anchor: Date, view: CalendarView): Date[] {
  if (view === "day") return [startOfDay(anchor)];
  if (view === "week") {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }
  const start = startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function visibleRange(anchor: Date, view: CalendarView): { from: Date; to: Date } {
  const days = visibleDays(anchor, view);
  return { from: days[0]!, to: addDays(days.at(-1)!, 1) };
}

/** Steps one page of the view forward or back. */
export function shiftAnchor(anchor: Date, view: CalendarView, direction: 1 | -1): Date {
  if (view === "day") return addDays(anchor, direction);
  if (view === "week") return addDays(anchor, 7 * direction);
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

export function groupByDay(occurrences: RoutineOccurrence[]): Map<string, RoutineOccurrence[]> {
  const groups = new Map<string, RoutineOccurrence[]>();
  for (const occurrence of occurrences) {
    const key = dayKey(new Date(occurrence.at));
    groups.set(key, [...(groups.get(key) ?? []), occurrence]);
  }
  return groups;
}

/** A readable block is never shorter than this, however short the entry is. */
const MIN_BLOCK_HEIGHT = 22;
const DEFAULT_EVENT_MINUTES = 30;
export const HOUR_HEIGHT = 56;

const minuteOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

export type PlacedEntry = {
  item: RoutineOccurrence;
  top: number;
  height: number;
  /** Which lane of the overlapping group the block sits in, from the left. */
  column: number;
  /** How many lanes the group has, so a lone entry spans the whole day column. */
  columns: number;
};

/**
 * Where each entry of one day sits on a grid of hours. An entry is a moment, not a span, so it is
 * drawn as a short block; entries that would sit on top of each other share the width.
 */
export function layoutDayEvents(
  items: RoutineOccurrence[],
  options: { hourHeight?: number; eventMinutes?: number } = {},
): PlacedEntry[] {
  const hourHeight = options.hourHeight ?? HOUR_HEIGHT;
  const span = options.eventMinutes ?? DEFAULT_EVENT_MINUTES;
  const sorted = [...items].sort((a, b) => a.at.localeCompare(b.at));
  const placed: PlacedEntry[] = [];
  let group: PlacedEntry[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const closeGroup = () => {
    for (const entry of group) entry.columns = laneEnds.length;
    group = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    const start = minuteOfDay(new Date(item.at));
    if (start >= groupEnd) closeGroup();
    const free = laneEnds.findIndex((end) => end <= start);
    const column = free === -1 ? laneEnds.length : free;
    laneEnds[column] = start + span;
    groupEnd = Math.max(groupEnd, start + span);
    const entry: PlacedEntry = {
      item,
      top: (start / 60) * hourHeight,
      height: Math.max(MIN_BLOCK_HEIGHT, (span / 60) * hourHeight),
      column,
      columns: 1,
    };
    group.push(entry);
    placed.push(entry);
  }
  closeGroup();
  return placed;
}

/** The distance from the top of the day to the current time. */
export function nowOffset(now: Date, hourHeight = HOUR_HEIGHT): number {
  return (minuteOfDay(now) / 60) * hourHeight;
}

/** What a person wants to know at a glance: did anything fail, and what is next. */
export function summarizeCalendar(
  occurrences: RoutineOccurrence[],
  now: Date,
): { failed: RoutineOccurrence[]; next: RoutineOccurrence | null } {
  const failed = occurrences
    .filter((item) => item.state === "failed")
    .sort((a, b) => b.at.localeCompare(a.at));
  const next =
    occurrences
      .filter((item) => item.state === "upcoming" && new Date(item.at) > now)
      .sort((a, b) => a.at.localeCompare(b.at))[0] ?? null;
  return { failed, next };
}

/** How long a run took, in the viewer's language: seconds, minutes, or hours and minutes. */
export function formatRunDuration(ms: number, locale: string): string {
  const unit = (value: number, name: "second" | "minute" | "hour") =>
    new Intl.NumberFormat(locale, { style: "unit", unit: name, unitDisplay: "short" }).format(
      value,
    );
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return unit(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return unit(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? unit(hours, "hour") : `${unit(hours, "hour")} ${unit(rest, "minute")}`;
}
