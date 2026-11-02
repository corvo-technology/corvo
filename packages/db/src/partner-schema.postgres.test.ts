import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { asSystem } from "./row-security.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("partner tables (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  let prisma: PrismaClient;
  let db: PrismaClient;
  let close: () => Promise<void>;
  const ids = { organizations: [] as string[], users: [] as string[], partners: [] as string[] };

  async function tenantParts(label: string) {
    const userId = `partner-user-${label}-${suffix}`;
    const organizationId = `partner-org-${label}-${suffix}`;
    await db.user.create({
      data: { id: userId, name: label, email: `${userId}@partner.invalid` },
    });
    await db.organization.create({
      data: { id: organizationId, name: label, slug: organizationId, createdAt: new Date() },
    });
    ids.users.push(userId);
    ids.organizations.push(organizationId);
    return { userId, organizationId };
  }

  async function partner(label: string) {
    const created = await db.partner.create({
      data: {
        id: `partner-${label}-${suffix}`,
        slug: `acme-${label}-${suffix}`,
        name: `Acme ${label}`,
        keyPrefix: `pk_${label}_${suffix}`,
        keyHash: `hash-${label}`,
      },
    });
    ids.partners.push(created.id);
    return created;
  }

  beforeAll(async () => {
    const connection = createDb(databaseUrl!);
    prisma = connection.prisma;
    db = asSystem(prisma);
    close = async () => {
      await prisma.$disconnect();
      await connection.pool.end();
    };
  });

  afterAll(async () => {
    await db.partner.deleteMany({ where: { id: { in: ids.partners } } });
    await db.organization.deleteMany({ where: { id: { in: ids.organizations } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
    await close();
  });

  it("lets two partners use the same external tenant id, and refuses it twice for one partner", async () => {
    const a = await partner("a");
    const b = await partner("b");
    const first = await tenantParts("t1");
    const second = await tenantParts("t2");
    const third = await tenantParts("t3");
    const make = (partnerId: string, parts: { userId: string; organizationId: string }) =>
      db.partnerTenant.create({
        data: {
          partnerId,
          externalTenantId: "shop-1",
          organizationId: parts.organizationId,
          ownerUserId: parts.userId,
        },
      });
    await make(a.id, first);
    await make(b.id, second);
    await expect(make(a.id, third)).rejects.toMatchObject({ code: "P2002" });
  });

  it("maps one organization to at most one tenant", async () => {
    const a = await partner("c");
    const parts = await tenantParts("t4");
    await db.partnerTenant.create({
      data: {
        partnerId: a.id,
        externalTenantId: "one",
        organizationId: parts.organizationId,
        ownerUserId: parts.userId,
      },
    });
    await expect(
      db.partnerTenant.create({
        data: {
          partnerId: a.id,
          externalTenantId: "two",
          organizationId: parts.organizationId,
          ownerUserId: parts.userId,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("starts a tenant enabled, and keeps a partner's slug and key prefix unique", async () => {
    const a = await partner("d");
    const parts = await tenantParts("t5");
    const tenant = await db.partnerTenant.create({
      data: {
        partnerId: a.id,
        externalTenantId: "x",
        organizationId: parts.organizationId,
        ownerUserId: parts.userId,
      },
    });
    expect(tenant.state).toBe("enabled");
    await expect(
      db.partner.create({
        data: { slug: a.slug, name: "Again", keyPrefix: "pk_other", keyHash: "h" },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      db.partner.create({
        data: { slug: `acme-other-${suffix}`, name: "Again", keyPrefix: a.keyPrefix, keyHash: "h" },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("stores an entry code once by its hash", async () => {
    const a = await partner("e");
    const parts = await tenantParts("t6");
    const tenant = await db.partnerTenant.create({
      data: {
        partnerId: a.id,
        externalTenantId: "y",
        organizationId: parts.organizationId,
        ownerUserId: parts.userId,
      },
    });
    const data = {
      codeHash: `code-hash-${suffix}`,
      partnerId: a.id,
      tenantId: tenant.id,
      externalUserId: "staff-1",
      expiresAt: new Date(Date.now() + 60_000),
    };
    await db.partnerEntryCode.create({ data });
    await expect(db.partnerEntryCode.create({ data })).rejects.toMatchObject({ code: "P2002" });
  });
});
