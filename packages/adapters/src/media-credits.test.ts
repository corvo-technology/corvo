import type { PrismaClient } from "@corvo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  organizationForMember: vi.fn(),
  creditAccount: vi.fn(),
  reserveModelCredits: vi.fn(),
  settleModelCredits: vi.fn(),
}));
vi.mock("@corvo/db", () => db);

import { IMAGE_HOLD_USD, MediaCreditsError, mediaCredits } from "./media-credits.js";

const prisma = {} as PrismaClient;
const scope = { userId: "user", spaceId: "space", runId: "run" };

beforeEach(() => {
  for (const fn of Object.values(db)) fn.mockReset();
  db.organizationForMember.mockResolvedValue({ organizationId: "org" });
  db.creditAccount.mockResolvedValue({ mode: "credits" });
  db.reserveModelCredits.mockResolvedValue("entry");
  db.settleModelCredits.mockResolvedValue(undefined);
});

describe("media credits", () => {
  it("holds a bounded amount on the account of the person's organization, once per job", async () => {
    await mediaCredits(prisma, scope).hold("job-1", "google/gemini-2.5-flash-image");
    expect(db.reserveModelCredits).toHaveBeenCalledWith(prisma, "org", IMAGE_HOLD_USD, {
      callId: "media:job-1",
      userId: "user",
      spaceId: "space",
      runId: "run",
      provider: "openrouter",
      model: "google/gemini-2.5-flash-image",
    });
  });

  it("settles at the reported cost, or at the hold when none was reported", async () => {
    const hold = await mediaCredits(prisma, scope).hold("job", undefined);
    await hold.settle(0.04);
    expect(db.settleModelCredits).toHaveBeenLastCalledWith(prisma, "entry", 0.04);
    await hold.settle(undefined);
    expect(db.settleModelCredits).toHaveBeenLastCalledWith(prisma, "entry", IMAGE_HOLD_USD);
  });

  it("returns the whole hold on release", async () => {
    const hold = await mediaCredits(prisma, scope).hold("job", undefined);
    await hold.release();
    expect(db.settleModelCredits).toHaveBeenCalledWith(prisma, "entry", 0);
  });

  it("refuses an account that is not on credits, without holding anything", async () => {
    db.creditAccount.mockResolvedValue({ mode: "own_key" });
    await expect(mediaCredits(prisma, scope).hold("job", undefined)).rejects.toThrow(
      new MediaCreditsError("Image generation needs credits. Add credits in Billing."),
    );
    expect(db.reserveModelCredits).not.toHaveBeenCalled();
  });

  it("refuses a person with no organization", async () => {
    db.organizationForMember.mockResolvedValue(null);
    await expect(mediaCredits(prisma, scope).hold("job", undefined)).rejects.toBeInstanceOf(
      MediaCreditsError,
    );
  });

  it("says plainly when the balance is too low, and passes any other failure through", async () => {
    db.reserveModelCredits.mockRejectedValueOnce(
      new Error("Not enough model credits. Add credits in Billing or connect your own API key."),
    );
    await expect(mediaCredits(prisma, scope).hold("job", undefined)).rejects.toThrow(
      new MediaCreditsError("Not enough credit for an image. Add credits in Billing."),
    );
    const broken = new Error("connection lost");
    db.reserveModelCredits.mockRejectedValueOnce(broken);
    await expect(mediaCredits(prisma, scope).hold("job", undefined)).rejects.toBe(broken);
  });
});
