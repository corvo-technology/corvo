import type { PrismaClient } from "@corvo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { botDailyLimitReached } from "./bot-daily-limit.js";

const spend = vi.hoisted(() => vi.fn());
vi.mock("@corvo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@corvo/db")>()),
  botCreditSpendMicros: spend,
}));

const prisma = {} as PrismaClient;
const now = new Date("2026-11-06T15:30:00Z");

beforeEach(() => spend.mockReset());

describe("botDailyLimitReached", () => {
  it("is never reached, and never asks, when the bot has no limit", async () => {
    expect(await botDailyLimitReached(prisma, { id: "b", dailyCapMicros: null }, now)).toBe(false);
    expect(spend).not.toHaveBeenCalled();
  });

  it("counts spend from the start of the UTC day", async () => {
    spend.mockResolvedValue(0n);
    await botDailyLimitReached(prisma, { id: "b", dailyCapMicros: 1_000_000n }, now);
    expect(spend).toHaveBeenCalledWith(prisma, "b", new Date("2026-11-06T00:00:00Z"));
  });

  it("is reached once spend equals the limit, not before", async () => {
    const bot = { id: "b", dailyCapMicros: 2_000_000n };
    spend.mockResolvedValueOnce(1_999_999n);
    expect(await botDailyLimitReached(prisma, bot, now)).toBe(false);
    spend.mockResolvedValueOnce(2_000_000n);
    expect(await botDailyLimitReached(prisma, bot, now)).toBe(true);
    spend.mockResolvedValueOnce(5_000_000n);
    expect(await botDailyLimitReached(prisma, bot, now)).toBe(true);
  });
});
