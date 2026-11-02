/** Where the two eyes sit on the face's 100-unit tile, and how big they are. */
export const MASCOT_EYES = {
  centers: [
    { x: 32.5, y: 43.5 },
    { x: 67.5, y: 43.5 },
  ],
  rx: 7.5,
  ry: 9.5,
  /** Eyes that are asleep are a thin line, lower on the face. */
  sleepyRy: 3,
  sleepyY: 45,
} as const;

/** The furthest, in tile units, the eyes move from the middle to look at something. */
export const EYE_REACH = 4;

/** Past this distance, in pixels, the eyes look as far as they can. */
const FULL_REACH_DISTANCE = 240;

/**
 * Where the eyes look when something is at `to` and the mascot is at `from`: toward it, further the
 * further away it is, up to `EYE_REACH`. Straight ahead when it is right on the mascot.
 */
export function eyeLook(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return { x: 0, y: 0 };
  const strength = Math.min(1, distance / FULL_REACH_DISTANCE) * EYE_REACH;
  return { x: (dx / distance) * strength, y: (dy / distance) * strength };
}

export type MascotMood = "idle" | "thinking" | "alert" | "failed" | "happy";

/** How the mascot feels, from what its run is doing and whether work just finished. */
export function mascotMood(status: string | undefined, justFinished: boolean): MascotMood {
  switch (status) {
    case "queued":
    case "leased":
    case "running":
      return "thinking";
    case "waiting_input":
    case "waiting_takeover":
      return "alert";
    case "failed":
      return "failed";
    default:
      return justFinished ? "happy" : "idle";
  }
}
