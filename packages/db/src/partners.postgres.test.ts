import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import {
  authenticatePartner,
  createPartner,
  rotatePartnerKey,
  setPartnerEnabled,
} from "./partners.js";
import { asSystem } from "./row-security.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("partner keys (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  let prisma: PrismaClient;
  let db: PrismaClient;
  let close: () => Promise<void>;
  const slugs: string[] = [];
  const slug = (label: string) => {
    const value = `acme-${label}-${suffix}`;
    slugs.push(value);
    return value;
  };

  beforeAll(() => {
    const connection = createDb(databaseUrl!);
    prisma = connection.prisma;
    db = asSystem(prisma);
    close = async () => {
      await prisma.$disconnect();
      await connection.pool.end();
    };
  });
  afterAll(async () => {
    await db.partner.deleteMany({ where: { slug: { in: slugs } } });
    await close();
  });

  it("creates a partner whose key authenticates it, and stores only a hash", async () => {
    const { partner, key } = await createPartner(db, { slug: slug("a"), name: "Acme A" });
    const stored = await db.partner.findUniqueOrThrow({ where: { id: partner.id } });
    expect(stored.keyHash).not.toContain(key);
    expect(JSON.stringify(stored)).not.toContain(key);
    await expect(authenticatePartner(db, key)).resolves.toMatchObject({ id: partner.id });
  });

  it("does not know a key that was never issued, or a made-up key with a real prefix", async () => {
    const { key } = await createPartner(db, { slug: slug("b"), name: "Acme B" });
    const forged = `${key.slice(0, key.indexOf(".") + 1)}${"A".repeat(43)}`;
    await expect(authenticatePartner(db, forged)).resolves.toBeNull();
    await expect(authenticatePartner(db, "nonsense")).resolves.toBeNull();
    await expect(authenticatePartner(db, "")).resolves.toBeNull();
  });

  it("stops the old key at once when the key is rotated", async () => {
    const { partner, key } = await createPartner(db, { slug: slug("c"), name: "Acme C" });
    const rotated = await rotatePartnerKey(db, partner.slug);
    await expect(authenticatePartner(db, key)).resolves.toBeNull();
    await expect(authenticatePartner(db, rotated.key)).resolves.toMatchObject({ id: partner.id });
  });

  it("never authenticates a disabled partner, and does again once it is enabled", async () => {
    const { partner, key } = await createPartner(db, { slug: slug("d"), name: "Acme D" });
    await setPartnerEnabled(db, partner.slug, false);
    await expect(authenticatePartner(db, key)).resolves.toBeNull();
    await setPartnerEnabled(db, partner.slug, true);
    await expect(authenticatePartner(db, key)).resolves.toMatchObject({ id: partner.id });
  });

  it("refuses a second partner with the same slug, and an unknown partner on rotate", async () => {
    const taken = slug("e");
    await createPartner(db, { slug: taken, name: "Acme E" });
    await expect(createPartner(db, { slug: taken, name: "Other" })).rejects.toThrow();
    await expect(rotatePartnerKey(db, `missing-${suffix}`)).rejects.toThrow(/unknown partner/i);
  });
});
