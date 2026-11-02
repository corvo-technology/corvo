/** When something ran or will run: the time for today, the weekday and time for any other day. */
export function formatWhen(at: string, now: Date, locale: string): string {
  const date = new Date(at);
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
  if (date.toDateString() === now.toDateString()) return time;
  const day = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  return `${day} ${time}`;
}

/** The steps with one swapped with its neighbour; unchanged at either end. */
export function moveStep<T>(steps: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  const next = [...steps];
  if (target < 0 || target >= next.length || index < 0 || index >= next.length) return next;
  [next[index], next[target]] = [next[target] as T, next[index] as T];
  return next;
}

/** The steps with one added at `index`, or at the end when `index` is past it. */
export function insertStep<T>(steps: readonly T[], index: number, step: T): T[] {
  const next = [...steps];
  next.splice(Math.max(0, Math.min(index, next.length)), 0, step);
  return next;
}
