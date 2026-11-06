import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWhatsAppOutboxDrain } from "./outbox-drain.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createWhatsAppOutboxDrain", () => {
  it("sends only WhatsApp rows, on a short interval", async () => {
    const drain = vi.fn(async () => undefined);
    const stop = createWhatsAppOutboxDrain({ drain, everyMs: 1_000 });
    await vi.advanceTimersByTimeAsync(3_000);
    stop();
    expect(drain).toHaveBeenCalledTimes(3);
    expect(drain).toHaveBeenCalledWith({ onlyThreadPrefix: "whatsapp-web:" });
  });

  it("never runs two drains at once", async () => {
    let running = 0;
    let most = 0;
    const drain = vi.fn(async () => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((done) => setTimeout(done, 2_500));
      running -= 1;
    });
    const stop = createWhatsAppOutboxDrain({ drain, everyMs: 1_000 });
    await vi.advanceTimersByTimeAsync(10_000);
    stop();
    expect(most).toBe(1);
  });

  it("keeps going after a drain fails, and reports it", async () => {
    const onError = vi.fn();
    const drain = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(undefined);
    const stop = createWhatsAppOutboxDrain({ drain, everyMs: 1_000, onError });
    await vi.advanceTimersByTimeAsync(3_000);
    stop();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(drain.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("stops when asked", async () => {
    const drain = vi.fn(async () => undefined);
    const stop = createWhatsAppOutboxDrain({ drain, everyMs: 1_000 });
    await vi.advanceTimersByTimeAsync(1_000);
    stop();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(drain).toHaveBeenCalledTimes(1);
  });
});
