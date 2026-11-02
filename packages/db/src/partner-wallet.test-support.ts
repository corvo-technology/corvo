import type { PrismaClient } from "./client.js";
import { reconcileCreditPurchase } from "./model-credits.js";

/**
 * Gives a partner an owner whose own credit account holds `cents`, which is what a partner made in
 * the app has. Returns what the test must delete when it is done. Call with a client that runs as
 * the system.
 */
export async function giveWallet(
  db: PrismaClient,
  partnerId: string,
  label: string,
  cents: number,
): Promise<{ userId: string; organizationId: string }> {
  const userId = `wallet-owner-${label}`;
  const organizationId = `wallet-org-${label}`;
  await db.user.create({
    data: { id: userId, name: label, email: `${userId}@example.test`, emailVerified: true },
  });
  await db.organization.create({
    data: { id: organizationId, name: label, slug: `w-${label}`, createdAt: new Date() },
  });
  await db.member.create({
    data: {
      id: `wallet-member-${label}`,
      organizationId,
      userId,
      role: "owner",
      createdAt: new Date(),
    },
  });
  await db.modelCreditAccount.create({ data: { organizationId, mode: "credits" } });
  await reconcileCreditPurchase(db, organizationId, {
    id: `wallet-fund-${label}`,
    amountCents: cents,
  });
  await db.partner.update({ where: { id: partnerId }, data: { ownerUserId: userId } });
  return { userId, organizationId };
}
