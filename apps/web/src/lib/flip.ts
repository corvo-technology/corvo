import { useLayoutEffect, useRef } from "react";

/** How far each row that is still there has moved, as the distance back to where it was. */
export function flipDeltas(
  before: ReadonlyMap<string, number>,
  after: ReadonlyMap<string, number>,
): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const [id, top] of after) {
    const previous = before.get(id);
    if (previous !== undefined && previous !== top) deltas.set(id, previous - top);
  }
  return deltas;
}

const DURATION_MS = 200;

/**
 * Slides rows marked `data-flip-id` from where they were to where they are after the list is
 * reordered, instead of letting them jump. Only transform animates, and not for people who reduce
 * motion. Runs after every render and does nothing when no row moved.
 */
export function useFlipRows(): void {
  const previous = useRef<Map<string, number>>(new Map());
  useLayoutEffect(() => {
    const rows = [...document.querySelectorAll<HTMLElement>("[data-flip-id]")];
    const next = new Map(rows.map((row) => [row.dataset.flipId ?? "", row.offsetTop]));
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      const deltas = flipDeltas(previous.current, next);
      for (const row of rows) {
        const delta = deltas.get(row.dataset.flipId ?? "");
        if (delta === undefined) continue;
        row.animate?.([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], {
          duration: DURATION_MS,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        });
      }
    }
    previous.current = next;
  });
}
