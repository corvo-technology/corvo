import { beforeEach, describe, expect, it, vi } from "vitest";
import { updatePlanCard } from "./plan-card.js";
import { startPlanStep } from "./run-tools-messaging.js";

vi.mock("./plan-card.js", () => ({ updatePlanCard: vi.fn(async () => ({ ok: true })) }));

const ctx = {
  deps: {},
  run: { spaceId: "space-1" },
  bot: { id: "bot-1" },
  thread: { id: "thread-1" },
} as unknown as Parameters<typeof startPlanStep>[0];

beforeEach(() => vi.mocked(updatePlanCard).mockClear());

describe("startPlanStep", () => {
  it("marks the step running on this chat's plan once the stage is sent", async () => {
    await startPlanStep(ctx, " 2 ");
    expect(updatePlanCard).toHaveBeenCalledWith(
      ctx.deps,
      { spaceId: "space-1", threadId: "thread-1", botId: "bot-1" },
      { updates: [{ step: "2", status: "running" }] },
    );
  });

  it("does nothing without a step", async () => {
    await startPlanStep(ctx, undefined);
    await startPlanStep(ctx, "   ");
    expect(updatePlanCard).not.toHaveBeenCalled();
  });

  it("never fails the send when the plan cannot be updated", async () => {
    vi.mocked(updatePlanCard).mockRejectedValueOnce(new Error("down"));
    await expect(startPlanStep(ctx, "1")).resolves.toBeUndefined();
  });
});
