import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { purgeExpiredEntryCodes, takePartnerRequest } from "./partner-housekeeping.js";
import { provisionPartnerTenant } from "./partner-tenants.js";
import { createPartner } from "./partners.js";
import { asSystem } from "./row-security.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("partner housekeeping (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  let prisma: PrismaClient;
  let db: PrismaClient;
  let close: () => Promise<void>;
  const partnerIds: string[] = [];
  const organizationIds: string[] = [];
  const userIds: string[] = [];

  async function partner(label: string) {
    const { partner } = await createPartner(db, { slug: `hk-${label}-${suffix}`, name: label });
    partnerIds.push(partner.id);
    return partner;
  }

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
    await db.partner.deleteMany({ where: { id: { in: partnerIds } } });
    await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await close();
  });

  it("allows up to the limit in a minute, then refuses, then allows in the next minute", async () => {
    const p = await partner("limit");
    const t0 = new Date("2030-01-01T10:00:10.000Z");
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await takePartnerRequest(db, p.id, 3, t0));
    expect(results).toEqual([true, true, true, false]);
    await expect(
      takePartnerRequest(db, p.id, 3, new Date("2030-01-01T10:01:05.000Z")),
    ).resolves.toBe(true);
  });

  it("counts together requests that arrive at the same time", async () => {
    const p = await partner("race");
    const now = new Date("2030-01-01T11:00:00.000Z");
    const results = await Promise.all(
      Array.from({ length: 10 }, () => takePartnerRequest(db, p.id, 4, now)),
    );
    expect(results.filter(Boolean)).toHaveLength(4);
  });

  it("limits each partner on its own", async () => {
    const a = await partner("own-a");
    const b = await partner("own-b");
    const now = new Date("2030-01-01T12:00:00.000Z");
    await takePartnerRequest(db, a.id, 1, now);
    await expect(takePartnerRequest(db, a.id, 1, now)).resolves.toBe(false);
    await expect(takePartnerRequest(db, b.id, 1, now)).resolves.toBe(true);
  });

  it("removes old minutes as it goes", async () => {
    const p = await partner("old");
    await takePartnerRequest(db, p.id, 5, new Date("2030-01-01T08:00:00.000Z"));
    await takePartnerRequest(db, p.id, 5, new Date("2030-01-01T10:30:00.000Z"));
    const rows = await db.partnerRequestWindow.findMany({ where: { partnerId: p.id } });
    expect(rows.map((r) => r.windowStart.toISOString())).toEqual(["2030-01-01T10:30:00.000Z"]);
  });

  it("purges entry codes that expired long ago and keeps recent and live ones", async () => {
    const p = await partner("purge");
    const tenant = await provisionPartnerTenant(db, p, { externalTenantId: "t", name: "T" });
    organizationIds.push(tenant.organizationId);
    userIds.push(tenant.ownerUserId);
    const now = new Date("2030-06-01T12:00:00.000Z");
    const make = (hash: string, expiresAt: Date) =>
      db.partnerEntryCode.create({
        data: {
          codeHash: `${hash}-${suffix}`,
          partnerId: p.id,
          tenantId: tenant.tenantId,
          externalUserId: "u",
          expiresAt,
        },
      });
    await make("old", new Date(now.getTime() - 3 * 3_600_000));
    await make("recent", new Date(now.getTime() - 60_000));
    await make("live", new Date(now.getTime() + 60_000));
    await purgeExpiredEntryCodes(db, now);
    const left = await db.partnerEntryCode.findMany({ where: { partnerId: p.id } });
    expect(left.map((c) => c.codeHash.split("-")[0]).sort()).toEqual(["live", "recent"]);
  });
});
