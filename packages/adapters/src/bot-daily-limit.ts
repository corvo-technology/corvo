import type { PrismaClient } from "@corvo/db";
import { botCreditSpendMicros, utcDayStart } from "@corvo/db";

/** Whether a bot has taken as much from hosted credits today as its owner allowed. */
export async function botDailyLimitReached(
  prisma: PrismaClient,
  bot: { id: string; dailyCapMicros?: bigint | null },
  now = new Date(),
) {
  if (bot.dailyCapMicros == null) return false;
  return (await botCreditSpendMicros(prisma, bot.id, utcDayStart(now))) >= bot.dailyCapMicros;
}
