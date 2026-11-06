import { describe, expect, it } from "vitest";
import {
  createPacer,
  MAX_SENDS_PER_MINUTE,
  MAX_TYPING_MS,
  MIN_TYPING_MS,
  NUMBER_RUNS_PER_WINDOW,
  SENDER_RUNS_PER_WINDOW,
  WINDOW_MS,
} from "./pacing.js";

function fake(random = 0) {
  let now = 1_000_000;
  const sleeps: number[] = [];
  const typing: boolean[] = [];
  const pacer = createPacer({
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
    random: () => random,
  });
  const client = { setTyping: async (_chat: string, on: boolean) => void typing.push(on) };
  return {
    pacer,
    sleeps,
    typing,
    client,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("typing before a reply", () => {
  it("shows typing, waits in proportion to the text, and clears typing", async () => {
    const { pacer, sleeps, typing, client } = fake(0);
    await pacer.beforeSend("n1", client, "c1", "x".repeat(100));
    expect(typing).toEqual([true, false]);
    expect(sleeps).toEqual([100 * 40]);
  });

  it("never waits less than the minimum or more than the maximum", async () => {
    const { pacer, sleeps, client } = fake(1);
    await pacer.beforeSend("n1", client, "c1", "hi");
    await pacer.beforeSend("n1", client, "c1", "x".repeat(5000));
    expect(sleeps[0]).toBeGreaterThanOrEqual(MIN_TYPING_MS);
    expect(sleeps[1]).toBe(MAX_TYPING_MS);
  });

  it("adds up to thirty percent of jitter", async () => {
    const low = fake(0);
    const high = fake(0.999);
    await low.pacer.beforeSend("n1", low.client, "c1", "x".repeat(100));
    await high.pacer.beforeSend("n1", high.client, "c1", "x".repeat(100));
    expect(high.sleeps[0]).toBeGreaterThan(low.sleeps[0] as number);
    expect(high.sleeps[0]).toBeLessThanOrEqual((low.sleeps[0] as number) * 1.3);
  });

  it("clears typing even when something fails after it was shown", async () => {
    const typing: boolean[] = [];
    const pacer = createPacer({
      now: () => 0,
      sleep: async () => {
        throw new Error("interrupted");
      },
      random: () => 0,
    });
    await expect(
      pacer.beforeSend("n1", { setTyping: async (_c, on) => void typing.push(on) }, "c1", "hello"),
    ).rejects.toThrow("interrupted");
    expect(typing).toEqual([true, false]);
  });
});

describe("how many replies a number sends", () => {
  it("holds the next reply until the minute is over once the limit is reached", async () => {
    const { pacer, sleeps, client } = fake(0);
    for (let i = 0; i < MAX_SENDS_PER_MINUTE; i += 1)
      await pacer.beforeSend("n1", client, "c1", "hi");
    const before = sleeps.length;
    await pacer.beforeSend("n1", client, "c1", "one more");
    // A wait for the window, then the typing delay.
    const waits = sleeps.slice(before);
    expect(waits).toHaveLength(2);
    expect(waits[0]).toBeGreaterThan(0);
    expect(waits[0]).toBeLessThanOrEqual(60_000);
  });

  it("counts each number on its own", async () => {
    const { pacer, sleeps, client } = fake(0);
    for (let i = 0; i < MAX_SENDS_PER_MINUTE; i += 1)
      await pacer.beforeSend("n1", client, "c1", "hi");
    const before = sleeps.length;
    await pacer.beforeSend("n2", client, "c1", "hi");
    expect(sleeps.slice(before)).toHaveLength(1);
  });
});

describe("how much work a sender can start", () => {
  it("allows a sender a few runs per window, then drops the rest, without touching other senders", () => {
    const { pacer } = fake();
    for (let i = 0; i < SENDER_RUNS_PER_WINDOW; i += 1)
      expect(pacer.allowIncoming("n1", "ana")).toBe(true);
    expect(pacer.allowIncoming("n1", "ana")).toBe(false);
    expect(pacer.allowIncoming("n1", "bruno")).toBe(true);
  });

  it("lets a sender start again once the window has passed", () => {
    const { pacer, advance } = fake();
    for (let i = 0; i < SENDER_RUNS_PER_WINDOW; i += 1) pacer.allowIncoming("n1", "ana");
    expect(pacer.allowIncoming("n1", "ana")).toBe(false);
    advance(WINDOW_MS + 1);
    expect(pacer.allowIncoming("n1", "ana")).toBe(true);
  });

  it("limits a whole number, however many people write", () => {
    const { pacer } = fake();
    let allowed = 0;
    for (let i = 0; i < NUMBER_RUNS_PER_WINDOW + 20; i += 1) {
      if (pacer.allowIncoming("n1", `person-${i}`)) allowed += 1;
    }
    expect(allowed).toBe(NUMBER_RUNS_PER_WINDOW);
    expect(pacer.allowIncoming("n2", "person-0")).toBe(true);
  });

  it("does not count a dropped message against the sender's window", () => {
    const { pacer, advance } = fake();
    for (let i = 0; i < SENDER_RUNS_PER_WINDOW + 5; i += 1) pacer.allowIncoming("n1", "ana");
    // Only the allowed ones are counted, so the window frees exactly when the first of them ages out.
    advance(WINDOW_MS + 1);
    expect(pacer.allowIncoming("n1", "ana")).toBe(true);
  });
});
