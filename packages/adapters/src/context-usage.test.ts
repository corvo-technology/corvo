import type { PrismaClient } from "@corvo/db";
import { describe, expect, it, vi } from "vitest";
import { botContextUsage } from "./context-usage.js";

const scope = { spaceId: "space-1", userId: "user-1" };

function prismaWith(record: Record<string, unknown> | null) {
  const findFirst = vi.fn(async () => record);
  return { prisma: { usageRecord: { findFirst } } as unknown as PrismaClient, findFirst };
}

describe("botContextUsage", () => {
  it("adds the cached tokens to the input of the bot's last answer and reads the model's window", async () => {
    const { prisma, findFirst } = prismaWith({
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      inputTokens: 1_200,
      cacheReadTokens: 30_000,
      cacheWriteTokens: 800,
    });
    const usage = await botContextUsage(prisma, scope, "bot-1");
    expect(usage.usedTokens).toBe(32_000);
    expect(usage.windowTokens).toBeGreaterThan(32_000);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          spaceId: "space-1",
          userId: "user-1",
          botId: "bot-1",
          operationKind: "answer",
        }),
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("counts a missing cache figure as nothing, and has no window for an unknown model", async () => {
    const { prisma } = prismaWith({
      provider: "anthropic",
      model: "not-a-real-model",
      inputTokens: 500,
      cacheReadTokens: null,
      cacheWriteTokens: null,
    });
    expect(await botContextUsage(prisma, scope, "bot-1")).toEqual({
      usedTokens: 500,
      windowTokens: null,
    });
  });

  it("knows nothing before the bot has answered", async () => {
    const { prisma } = prismaWith(null);
    expect(await botContextUsage(prisma, scope, "bot-1")).toEqual({
      usedTokens: null,
      windowTokens: null,
    });
  });
});
