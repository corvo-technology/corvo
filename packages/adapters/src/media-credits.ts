import type { PrismaClient } from "@corvo/db";
import {
  creditAccount,
  organizationForMember,
  reserveModelCredits,
  settleModelCredits,
} from "@corvo/db";

/**
 * What one image holds on the account before it is made. Image prices vary by model and are
 * only known afterwards, so the hold covers a dear image and the difference goes back at once.
 */
export const IMAGE_HOLD_USD = 0.3;

/** A refusal the person can act on; its text is what the agent tells them. */
export class MediaCreditsError extends Error {}

export interface MediaCreditHold {
  /** Charge what the image cost, or the whole hold when the provider did not say. */
  settle(costUsd: number | undefined): Promise<void>;
  /** Give the whole hold back: nothing was generated. */
  release(): Promise<void>;
}

export interface MediaCredits {
  hold(jobId: string, model: string | undefined): Promise<MediaCreditHold>;
}

/** Images are paid from the credit of the organization the person acts for. */
export function mediaCredits(
  prisma: PrismaClient,
  scope: { userId: string; spaceId: string; runId: string },
): MediaCredits {
  return {
    async hold(jobId, model) {
      const membership = await organizationForMember(prisma, scope);
      const account = membership && (await creditAccount(prisma, membership.organizationId));
      if (!membership || account?.mode !== "credits")
        throw new MediaCreditsError("Image generation needs credits. Add credits in Billing.");
      let entryId: string;
      try {
        // One hold per job, so a retry of the same image is never charged twice.
        entryId = await reserveModelCredits(prisma, membership.organizationId, IMAGE_HOLD_USD, {
          callId: `media:${jobId}`,
          ...scope,
          provider: "openrouter",
          ...(model ? { model } : {}),
        });
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Not enough model credits"))
          throw new MediaCreditsError("Not enough credit for an image. Add credits in Billing.");
        throw error;
      }
      return {
        settle: (costUsd) => settleModelCredits(prisma, entryId, costUsd ?? IMAGE_HOLD_USD),
        release: () => settleModelCredits(prisma, entryId, 0),
      };
    },
  };
}
