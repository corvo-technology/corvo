import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import {
  createOwnedPartner,
  findOwnedPartner,
  listOwnedPartnerTenants,
  rotateOwnedPartnerKey,
  setOwnedPartnerTemplate,
} from "./partner-accounts.js";
import { provisionPartnerTenant } from "./partner-tenants.js";
import { authenticatePartner } from "./partners.js";
import { asSystem } from "./row-security.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("partner accounts (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  let prisma: PrismaClient;
  let db: PrismaClient;
  let close: () => Promise<void>;
  const userIds: string[] = [];
  const organizationIds: string[] = [];

  async function user(label: string) {
    const id = `pa-${label}-${suffix}`;
    await db.user.create({
      data: { id, name: label, email: `${id}@corvo.test`, emailVerified: true },
    });
    userIds.push(id);
    return id;
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
    await db.partner.deleteMany({ where: { ownerUserId: { in: userIds } } });
    await db.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await close();
  });

  it("makes a person a partner once and returns a key that works", async () => {
    const id = await user("once");
    const { partner, key } = await createOwnedPartner(db, id, "Acme SaaS");
    expect(partner.name).toBe("Acme SaaS");
    await expect(authenticatePartner(db, key)).resolves.toMatchObject({ id: partner.id });
    await expect(createOwnedPartner(db, id, "Again")).rejects.toThrow(/already/i);
    await expect(findOwnedPartner(db, id)).resolves.toMatchObject({ id: partner.id });
  });

  it("finds nothing for a person who is not a partner", async () => {
    await expect(findOwnedPartner(db, await user("none"))).resolves.toBeNull();
  });

  it("rotates only the caller's key, and the old one stops working", async () => {
    const a = await user("rot-a");
    const b = await user("rot-b");
    const first = await createOwnedPartner(db, a, "A");
    const other = await createOwnedPartner(db, b, "B");
    const rotated = await rotateOwnedPartnerKey(db, a);
    expect(rotated.key).not.toBe(first.key);
    await expect(authenticatePartner(db, first.key)).resolves.toBeNull();
    await expect(authenticatePartner(db, rotated.key)).resolves.toMatchObject({
      id: first.partner.id,
    });
    await expect(authenticatePartner(db, other.key)).resolves.toMatchObject({
      id: other.partner.id,
    });
    await expect(rotateOwnedPartnerKey(db, await user("rot-none"))).rejects.toThrow();
  });

  it("stores a template for the caller's partner only, and removes it", async () => {
    const a = await createOwnedPartner(db, await user("tpl-a"), "A");
    const b = await createOwnedPartner(db, await user("tpl-b"), "B");
    const template = {
      agents: [{ key: "manager", name: "Manager", instructions: "Go.", usesConnector: false }],
    };
    await expect(setOwnedPartnerTemplate(db, a.partner.ownerUserId!, template)).resolves.toBe(true);
    await expect(findOwnedPartner(db, a.partner.ownerUserId!)).resolves.toMatchObject({ template });
    await expect(findOwnedPartner(db, b.partner.ownerUserId!)).resolves.toMatchObject({
      template: null,
    });
    await expect(setOwnedPartnerTemplate(db, a.partner.ownerUserId!, null)).resolves.toBe(true);
    await expect(findOwnedPartner(db, a.partner.ownerUserId!)).resolves.toMatchObject({
      template: null,
    });
    await expect(setOwnedPartnerTemplate(db, await user("tpl-none"), template)).resolves.toBe(
      false,
    );
  });

  it("reports this month's spend and the balance of each customer, not another's", async () => {
    const a = await createOwnedPartner(db, await user("use-a"), "A");
    const one = await provisionPartnerTenant(db, a.partner, {
      externalTenantId: "u1",
      name: "U One",
    });
    const two = await provisionPartnerTenant(db, a.partner, {
      externalTenantId: "u2",
      name: "U Two",
    });
    organizationIds.push(one.organizationId, two.organizationId);
    userIds.push(one.ownerUserId, two.ownerUserId);
    const now = new Date("2030-06-15T12:00:00.000Z");
    await db.modelCreditAccount.update({
      where: { organizationId: one.organizationId },
      data: { balanceMicros: 3_800_000n },
    });
    const entry = (org: string, source: string, amountMicros: bigint, createdAt: Date) =>
      db.modelCreditEntry.create({
        data: { organizationId: org, source: `${source}-${suffix}`, amountMicros, createdAt },
      });
    await entry(one.organizationId, "this-1", -1_000_000n, new Date("2030-06-02T00:00:00Z"));
    await entry(one.organizationId, "this-2", -200_000n, new Date("2030-06-10T00:00:00Z"));
    await entry(one.organizationId, "last", -9_000_000n, new Date("2030-05-30T00:00:00Z"));
    await entry(one.organizationId, "grant", 5_000_000n, new Date("2030-06-01T00:00:00Z"));
    await entry(two.organizationId, "other", -4_000_000n, new Date("2030-06-03T00:00:00Z"));
    const list = await listOwnedPartnerTenants(db, a.partner.id, now);
    expect(list.find((t) => t.externalTenantId === "u1")).toMatchObject({
      usedUsd: 1.2,
      balanceUsd: 3.8,
    });
    expect(list.find((t) => t.externalTenantId === "u2")).toMatchObject({
      usedUsd: 4,
      balanceUsd: 0,
    });
  });

  it("lists a partner's own customers with their state, and no one else's", async () => {
    const a = await createOwnedPartner(db, await user("list-a"), "A");
    const b = await createOwnedPartner(db, await user("list-b"), "B");
    const one = await provisionPartnerTenant(db, a.partner, {
      externalTenantId: "s1",
      name: "Shop One",
    });
    const two = await provisionPartnerTenant(db, b.partner, {
      externalTenantId: "s2",
      name: "Shop Two",
    });
    organizationIds.push(one.organizationId, two.organizationId);
    userIds.push(one.ownerUserId, two.ownerUserId);
    await expect(listOwnedPartnerTenants(db, a.partner.id)).resolves.toEqual([
      { externalTenantId: "s1", name: "Shop One", state: "enabled", usedUsd: 0, balanceUsd: 0 },
    ]);
  });
});
