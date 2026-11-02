import { WAITING_ON_USER_RUN_STATUSES } from "@corvo/core";
import type { Prisma } from "@corvo/db";

/**
 * The member a message that names nobody is for: the one whose work is waiting on the person
 * (an answer, an approval, a takeover), and otherwise the one who worked last, as a teammate
 * the person is already talking to. Undefined before anyone has worked.
 */
export async function groupConversationOwner(
  tx: Prisma.TransactionClient,
  threadId: string,
  memberBotIds: readonly string[],
): Promise<string | undefined> {
  const botId = { in: [...memberBotIds] };
  const waiting = await tx.run.findFirst({
    where: { threadId, botId, status: { in: [...WAITING_ON_USER_RUN_STATUSES] } },
    orderBy: { createdAt: "desc" },
    select: { botId: true },
  });
  if (waiting) return waiting.botId;
  const latest = await tx.run.findFirst({
    where: { threadId, botId, status: { not: "cancelled" } },
    orderBy: { createdAt: "desc" },
    select: { botId: true },
  });
  return latest?.botId;
}
