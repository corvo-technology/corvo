import type { PrismaClient } from "./client.js";

/**
 * Spends an entry code and returns the owner of the customer it opens, or null. One conditional
 * update both checks and spends, so of any number of racing requests exactly one gets the owner.
 * A code that is unknown, spent, expired, or whose customer or partner has been switched off
 * since it was made all answer the same. Call with a client that runs as the system.
 */
export async function consumePartnerEntryCode(
  prisma: PrismaClient,
  codeHash: string,
  now = new Date(),
): Promise<{ userId: string } | null> {
  const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
    UPDATE "partner_entry_codes" AS code
    SET "usedAt" = ${now}
    FROM "partner_tenants" AS tenant, "partners" AS partner
    WHERE code."codeHash" = ${codeHash}
      AND code."usedAt" IS NULL
      AND code."expiresAt" > ${now}
      AND tenant."id" = code."tenantId"
      AND tenant."state" = 'enabled'
      AND partner."id" = tenant."partnerId"
      AND partner."enabled"
    RETURNING tenant."ownerUserId" AS "userId"`;
  return rows[0] ?? null;
}
