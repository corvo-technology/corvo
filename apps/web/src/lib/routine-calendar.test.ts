import type { RoutineOccurrence } from "@corvo/contracts";
import { describe, expect, it } from "vitest";
import {
  dayKey,
  formatRunDuration,
  groupByDay,
  layoutDayEvents,
  nowOffset,
  shiftAnchor,
  summarizeCalendar,
  visibleDays,
  visibleRange,
} from "./routine-calendar";

const at = (iso: string): RoutineOccurrence => ({
  routineId: "r1",
  name: "Summary",
  botId: "b1",
  botName: "Chief",
  at: new Date(iso).toISOString(),
  state: "upcoming",
  runId: null,
});

describe("routine calendar", () => {
  it("starts the week on Monday", () => {
    const days = visibleDays(new Date(2026, 9, 29), "week");
    expect(days.map((day) => day.getDate())).toEqual([26, 27, 28, 29, 30, 31, 1]);
    expect(days[0]!.getDay()).toBe(1);
  });

  it("shows a month as six whole weeks, which one query can cover", () => {
    const { from, to } = visibleRange(new Date(2026, 9, 29), "month");
    expect(visibleDays(new Date(2026, 9, 29), "month")).toHaveLength(42);
    expect((to.getTime() - from.getTime()) / 86_400_000).toBeGreaterThanOrEqual(41);
    expect((to.getTime() - from.getTime()) / 86_400_000).toBeLessThanOrEqual(43);
    expect(from.getDay()).toBe(1);
  });

  it("steps by a day, a week or a month", () => {
    const anchor = new Date(2026, 9, 29);
    expect(shiftAnchor(anchor, "day", 1).getDate()).toBe(30);
    expect(shiftAnchor(anchor, "week", -1).getDate()).toBe(22);
    expect(shiftAnchor(anchor, "month", 1)).toEqual(new Date(2026, 10, 1));
  });

  it("groups entries by the viewer's day, in time order within it", () => {
    const first = at(new Date(2026, 9, 29, 9, 0).toISOString());
    const second = at(new Date(2026, 9, 29, 15, 0).toISOString());
    const other = at(new Date(2026, 9, 30, 9, 0).toISOString());
    const groups = groupByDay([first, second, other]);
    expect(groups.get(dayKey(new Date(2026, 9, 29)))).toEqual([first, second]);
    expect(groups.get(dayKey(new Date(2026, 9, 30)))).toEqual([other]);
  });
});

const local = (hour: number, minute = 0) => new Date(2026, 9, 29, hour, minute).toISOString();
const entry = (
  hour: number,
  minute: number,
  over: Partial<RoutineOccurrence> = {},
): RoutineOccurrence => ({ ...at(local(hour, minute)), ...over });

describe("time grid layout", () => {
  it("puts an entry at its time, in the viewer's own hours", () => {
    const [placed] = layoutDayEvents([entry(8, 30)], { hourHeight: 48, eventMinutes: 30 });
    expect(placed).toMatchObject({ top: 8.5 * 48, height: 24, column: 0, columns: 1 });
  });

  it("never draws a block shorter than a readable line", () => {
    const [placed] = layoutDayEvents([entry(9, 0)], { hourHeight: 48, eventMinutes: 5 });
    expect(placed?.height).toBe(22);
  });

  it("puts entries that overlap side by side and leaves the others full width", () => {
    const placed = layoutDayEvents(
      [entry(9, 0, { routineId: "a" }), entry(9, 15, { routineId: "b" }), entry(12, 0)],
      { hourHeight: 48, eventMinutes: 30 },
    );
    const byTop = placed.sort((x, y) => x.top - y.top);
    expect(byTop.map((item) => [item.column, item.columns])).toEqual([
      [0, 2],
      [1, 2],
      [0, 1],
    ]);
  });

  it("reuses a column once its earlier entry has ended", () => {
    const placed = layoutDayEvents(
      [
        entry(9, 0, { routineId: "a" }),
        entry(9, 15, { routineId: "b" }),
        entry(9, 40, { routineId: "c" }),
      ],
      { hourHeight: 48, eventMinutes: 30 },
    );
    expect(placed.map((item) => item.column)).toEqual([0, 1, 0]);
    expect(placed.every((item) => item.columns === 2)).toBe(true);
  });

  it("marks now as an offset from the top of the day", () => {
    expect(nowOffset(new Date(2026, 9, 29, 6, 30), 48)).toBe(6.5 * 48);
  });
});

describe("calendar summary", () => {
  const now = new Date(2026, 9, 29, 12, 0);
  it("says everything is fine when nothing failed", () => {
    const summary = summarizeCalendar(
      [entry(8, 0, { state: "done" }), entry(18, 0, { state: "upcoming" })],
      now,
    );
    expect(summary.failed).toEqual([]);
    expect(summary.next?.at).toBe(local(18, 0));
  });

  it("lists failures newest first and points at the next entry still to come", () => {
    const summary = summarizeCalendar(
      [
        entry(7, 0, { state: "failed", routineId: "old" }),
        entry(9, 0, { state: "failed", routineId: "new" }),
        entry(11, 0, { state: "done" }),
        entry(15, 0, { state: "upcoming", routineId: "later" }),
        entry(13, 0, { state: "upcoming", routineId: "sooner" }),
        entry(10, 0, { state: "upcoming", routineId: "past" }),
      ],
      now,
    );
    expect(summary.failed.map((item) => item.routineId)).toEqual(["new", "old"]);
    expect(summary.next?.routineId).toBe("sooner");
  });

  it("has no next entry when nothing is due", () => {
    expect(summarizeCalendar([entry(8, 0, { state: "done" })], now).next).toBeNull();
  });
});

describe("run duration", () => {
  it("words a short run in seconds, a longer one in minutes, and a long one in hours", () => {
    expect(formatRunDuration(42_000, "en")).toBe("42 sec");
    expect(formatRunDuration(180_000, "en")).toBe("3 min");
    expect(formatRunDuration(3_900_000, "en")).toBe("1 hr 5 min");
  });

  it("never says zero seconds for a run that did start", () => {
    expect(formatRunDuration(300, "en")).toBe("1 sec");
  });

  it("follows the viewer's language", () => {
    expect(formatRunDuration(42_000, "pt-BR")).toMatch(/42/);
    expect(formatRunDuration(42_000, "pt-BR")).not.toBe(formatRunDuration(42_000, "en"));
  });
});
