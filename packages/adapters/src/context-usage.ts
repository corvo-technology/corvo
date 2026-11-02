import type { PrismaClient } from "@corvo/db";
import { modelContextWindow } from "./model-window.js";

/** What "compress" leaves as it was: the newest messages, so the thread keeps its thread of thought. */
export const COMPRESS_KEEP_RECENT = 6;

/**
 * What the bot's last answer read: its input, plus what came from the provider's cache. That is
 * the size of the context at the end of the last turn, and so what the next turn starts from.
 */
export async function botContextUsage(
  prisma: PrismaClient,
  scope: { spaceId: string; userId: string },
  botId: string,
): Promise<{ usedTokens: number | null; windowTokens: number | null }> {
  const record = await prisma.usageRecord.findFirst({
    where: {
      spaceId: scope.spaceId,
      userId: scope.userId,
      botId,
      operationKind: "answer",
      inputTokens: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: {
      provider: true,
      model: true,
      inputTokens: true,
      cacheReadTokens: true,
      cacheWriteTokens: true,
    },
  });
  if (!record) return { usedTokens: null, windowTokens: null };
  return {
    usedTokens:
      (record.inputTokens ?? 0) + (record.cacheReadTokens ?? 0) + (record.cacheWriteTokens ?? 0),
    windowTokens: modelContextWindow(record.provider, record.model),
  };
}
