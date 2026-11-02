import type { PrismaClient } from "./client.js";

const WINDOW_MS = 60_000;
const KEEP_MS = 60 * 60_000;

/**
 * Counts one request in the partner's current minute and says whether it is within `max`. The
 * count lives in the database, so every API process shares it, and the increment is one statement,
 * so requests arriving together are counted together. Old minutes are dropped when a new one
 * starts. Call with a client that runs as the system.
 */
export async function takePartnerRequest(
  prisma: PrismaClient,
  partnerId: string,
  max: number,
  now = new Date(),
): Promise<boolean> {
  const windowStart = new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "partner_request_windows" ("partnerId", "windowStart", "count")
    VALUES (${partnerId}, ${windowStart}, 1)
    ON CONFLICT ("partnerId", "windowStart")
    DO UPDATE SET "count" = "partner_request_windows"."count" + 1
    RETURNING "count"`;
  const count = rows[0]?.count ?? 0;
  if (count === 1) {
    await prisma.partnerRequestWindow.deleteMany({
      where: { partnerId, windowStart: { lt: new Date(windowStart.getTime() - KEEP_MS) } },
    });
  }
  return count <= max;
}

/** Entry codes are worthless a minute after they are made; keep an hour of them for audit. */
export async function purgeExpiredEntryCodes(
  prisma: PrismaClient,
  now = new Date(),
): Promise<number> {
  const result = await prisma.partnerEntryCode.deleteMany({
    where: { expiresAt: { lt: new Date(now.getTime() - 60 * 60_000) } },
  });
  return result.count;
}
