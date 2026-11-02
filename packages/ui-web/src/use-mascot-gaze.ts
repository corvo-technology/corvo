import { eyeLook } from "@corvo/core";
import type { RefObject } from "react";
import { useEffect } from "react";

const watchers = new Set<HTMLElement>();
let pointer: { x: number; y: number } | null = null;
let frame = 0;
let listening = false;

/** Reads every mascot's place first and writes after, so one pointer move costs one layout. */
function flush() {
  frame = 0;
  if (!pointer) return;
  const target = pointer;
  const reads = [...watchers].map((element) => ({
    element,
    rect: element.getBoundingClientRect(),
  }));
  for (const { element, rect } of reads) {
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    const look = eyeLook({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, target);
    element.style.setProperty("--gaze-x", `${look.x.toFixed(2)}px`);
    element.style.setProperty("--gaze-y", `${look.y.toFixed(2)}px`);
  }
}

function onMove(event: PointerEvent) {
  pointer = { x: event.clientX, y: event.clientY };
  if (!frame) frame = requestAnimationFrame(flush);
}

/**
 * Makes the eyes inside `ref` follow the pointer. One listener serves every mascot on the page,
 * and nothing runs for touch screens or for people who reduce motion.
 */
export function useMascotGaze(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element || typeof window.matchMedia !== "function") return;
    if (
      !window.matchMedia("(pointer: fine)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    watchers.add(element);
    if (!listening) {
      listening = true;
      window.addEventListener("pointermove", onMove, { passive: true });
    }
    return () => {
      watchers.delete(element);
      element.style.removeProperty("--gaze-x");
      element.style.removeProperty("--gaze-y");
      if (watchers.size === 0 && listening) {
        listening = false;
        window.removeEventListener("pointermove", onMove);
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };
  }, [ref, enabled]);
}
