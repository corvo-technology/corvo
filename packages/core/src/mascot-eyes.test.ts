import { describe, expect, it } from "vitest";
import { EYE_REACH, eyeLook, mascotMood } from "./mascot-eyes.js";

describe("eyeLook", () => {
  it("points the eyes toward the pointer, never further than they can move", () => {
    const right = eyeLook({ x: 100, y: 100 }, { x: 900, y: 100 });
    expect(right.x).toBeCloseTo(EYE_REACH, 1);
    expect(right.y).toBeCloseTo(0, 5);
    const upLeft = eyeLook({ x: 100, y: 100 }, { x: 0, y: 0 });
    expect(upLeft.x).toBeLessThan(0);
    expect(upLeft.y).toBeLessThan(0);
    expect(Math.hypot(upLeft.x, upLeft.y)).toBeLessThanOrEqual(EYE_REACH + 1e-9);
  });

  it("looks straight ahead when the pointer is on the mascot, and less far when it is near", () => {
    expect(eyeLook({ x: 50, y: 50 }, { x: 50, y: 50 })).toEqual({ x: 0, y: 0 });
    const near = eyeLook({ x: 0, y: 0 }, { x: 30, y: 0 });
    const far = eyeLook({ x: 0, y: 0 }, { x: 600, y: 0 });
    expect(near.x).toBeGreaterThan(0);
    expect(near.x).toBeLessThan(far.x);
  });
});

describe("mascotMood", () => {
  it("is thinking while a run is queued, starting or running", () => {
    for (const status of ["queued", "leased", "running"]) {
      expect(mascotMood(status, false)).toBe("thinking");
    }
  });

  it("is alert when it waits for the person, and failed after a failure", () => {
    expect(mascotMood("waiting_input", false)).toBe("alert");
    expect(mascotMood("waiting_takeover", false)).toBe("alert");
    expect(mascotMood("failed", false)).toBe("failed");
  });

  it("is happy for a moment after work finished, and otherwise at ease", () => {
    expect(mascotMood("idle", true)).toBe("happy");
    expect(mascotMood("idle", false)).toBe("idle");
    expect(mascotMood(undefined, false)).toBe("idle");
    // Still working or failing is not a happy moment, whatever else is true.
    expect(mascotMood("running", true)).toBe("thinking");
    expect(mascotMood("failed", true)).toBe("failed");
  });
});
