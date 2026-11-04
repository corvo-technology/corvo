import type { BoardEvent } from "@corvo/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { followBoard } from "./board-stream";

const frame = (ticketId: string): BoardEvent => ({
  spaceId: "s",
  ticketId,
  createdAt: "2026-11-05T10:00:00Z",
});

/** The frames, then a connection that stays open, as the real stream does. */
async function* frames(...items: BoardEvent[]) {
  for (const item of items) yield item;
  await new Promise(() => {});
}

afterEach(() => vi.useRealTimers());

describe("followBoard", () => {
  it("opens once, then hands over every frame", async () => {
    const onOpen = vi.fn();
    const seen: string[] = [];
    const stop = followBoard({
      subscribe: async () => frames(frame("a"), frame("b")),
      onOpen,
      onEvent: (event) => void seen.push(event.ticketId ?? ""),
    });
    await vi.waitFor(() => expect(seen).toEqual(["a", "b"]));
    expect(onOpen).toHaveBeenCalledTimes(1);
    stop();
  });

  it("tries again after a failure that is worth retrying, and reports it", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const seen: string[] = [];
    let calls = 0;
    const stop = followBoard({
      subscribe: async () => {
        calls += 1;
        if (calls === 1) throw new TypeError("fetch failed");
        return frames(frame("again"));
      },
      onEvent: (event) => void seen.push(event.ticketId ?? ""),
      onError,
    });
    await vi.advanceTimersByTimeAsync(5_000);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(["again"]);
    stop();
  });

  it("stops asking once it is told to stop", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const stop = followBoard({
      subscribe: async () => {
        calls += 1;
        throw new TypeError("fetch failed");
      },
      onEvent: () => {},
    });
    await vi.advanceTimersByTimeAsync(0);
    stop();
    const before = calls;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toBe(before);
  });
});
