import type { PrismaClient } from "./client.js";
import { reconcileCreditPurchase } from "./model-credits.js";
import { reservePartnerAllowance } from "./partner-wallet.js";

const MICROS_PER_CENT = 10_000n;
const PERIOD = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * Sets a partner customer's credit for a calendar month, using the same grant that pays for a
 * purchase. The credit expires when the month ends. Granting the same amount again changes
 * nothing; a larger amount adds only the difference as one more grant; a smaller amount never
 * takes credit back. The first grant and each raise have their own identity, so a repeated call
 * (even two at once) cannot add twice. Call with a client that runs as the system.
 */
export async function grantPartnerAllowance(
  prisma: PrismaClient,
  tenant: { organizationId: string; partnerId: string; externalTenantId: string },
  input: { amountCents: number; period: string },
): Promise<{ addedCents: number }> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("The allowance must be a whole, positive number of cents");
  }
  const month = PERIOD.exec(input.period);
  if (!month) throw new Error("The period must be a month such as 2026-11");
  // The month index of the next month, so this is the first instant after the period.
  const expiresAt = new Date(Date.UTC(Number(month[1]), Number(month[2]), 1)).toISOString();

  const prefix = `partner:${tenant.partnerId}:${tenant.externalTenantId}:${input.period}`;
  // A grant is stored under the source `purchase:<id>`.
  const granted = await prisma.modelCreditEntry.aggregate({
    _sum: { amountMicros: true },
    where: { organizationId: tenant.organizationId, source: { startsWith: `purchase:${prefix}:` } },
  });
  const grantedCents = Number((granted._sum.amountMicros ?? 0n) / MICROS_PER_CENT);
  const missing = input.amountCents - grantedCents;
  if (missing <= 0) return { addedCents: 0 };

  const id = grantedCents === 0 ? `${prefix}:base` : `${prefix}:raise:${input.amountCents}`;
  await reservePartnerAllowance(prisma, tenant, {
    holdId: id,
    period: input.period,
    totalCents: input.amountCents,
    missingCents: missing,
  });
  const addedMicros = await reconcileCreditPurchase(prisma, tenant.organizationId, {
    id,
    amountCents: missing,
    expiresAt,
  });
  return { addedCents: Math.round(addedMicros / Number(MICROS_PER_CENT)) };
}
