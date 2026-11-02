import {
  generatePartnerKey,
  partnerKeyPrefix,
  verifyPartnerKey,
} from "@corvo/core/node/partner-key";
import type { PrismaClient } from "./client.js";
import type { Partner } from "./generated/prisma/client.js";

/** Partner rows are internal: call these with a client that runs as the system. */
export async function createPartner(
  prisma: PrismaClient,
  input: { slug: string; name: string },
): Promise<{ partner: Partner; key: string }> {
  const issued = generatePartnerKey();
  const partner = await prisma.partner.create({
    data: {
      slug: input.slug,
      name: input.name,
      keyPrefix: issued.prefix,
      keyHash: issued.hash,
    },
  });
  return { partner, key: issued.key };
}

/** The old key stops working in the same statement that stores the new one. */
export async function rotatePartnerKey(
  prisma: PrismaClient,
  slug: string,
): Promise<{ partner: Partner; key: string }> {
  const issued = generatePartnerKey();
  const result = await prisma.partner.updateMany({
    where: { slug },
    data: { keyPrefix: issued.prefix, keyHash: issued.hash },
  });
  if (result.count === 0) throw new Error(`Unknown partner: ${slug}`);
  const partner = await prisma.partner.findUniqueOrThrow({ where: { slug } });
  return { partner, key: issued.key };
}

export async function setPartnerEnabled(
  prisma: PrismaClient,
  slug: string,
  enabled: boolean,
): Promise<void> {
  const result = await prisma.partner.updateMany({ where: { slug }, data: { enabled } });
  if (result.count === 0) throw new Error(`Unknown partner: ${slug}`);
}

/** The partner a key belongs to, or null for a key that is unknown, wrong or disabled. */
export async function authenticatePartner(
  prisma: PrismaClient,
  key: string,
): Promise<Partner | null> {
  const prefix = partnerKeyPrefix(key);
  if (prefix === null) return null;
  const partner = await prisma.partner.findUnique({ where: { keyPrefix: prefix } });
  if (!partner?.enabled || !verifyPartnerKey(key, partner.keyHash)) return null;
  return partner;
}
