import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import {
  findPartnerTenant,
  partnerSpaceState,
  provisionPartnerTenant,
  setPartnerTenantState,
} from "./partner-tenants.js";
import { createPartner } from "./partners.js";
import { asSystem } from "./row-security.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("partner tenants (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  let prisma: PrismaClient;
  let db: PrismaClient;
  let close: () => Promise<void>;
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  const partnerIds: string[] = [];

  async function newPartner(label: string) {
    const { partner } = await createPartner(db, { slug: `acme-${label}-${suffix}`, name: label });
    partnerIds.push(partner.id);
    return partner;
  }

  function remember(result: { organizationId: string; ownerUserId: string }) {
    organizationIds.push(result.organizationId);
    userIds.push(result.ownerUserId);
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

  it("gives a customer its own organization, space, owner and credit account", async () => {
    const partner = await newPartner("own");
    const result = await provisionPartnerTenant(db, partner, {
      externalTenantId: "shop-1",
      name: "Shop One",
    });
    remember(result);
    expect(result.created).toBe(true);
    const owner = await db.member.findFirst({ where: { organizationId: result.organizationId } });
    expect(owner).toMatchObject({ userId: result.ownerUserId, role: "owner" });
    const space = await db.space.findUniqueOrThrow({ where: { id: result.spaceId } });
    expect(space).toMatchObject({ organizationId: result.organizationId, isDefault: true });
    await expect(
      db.spaceMember.findFirst({ where: { spaceId: result.spaceId, userId: result.ownerUserId } }),
    ).resolves.toMatchObject({ role: "owner" });
    await expect(
      db.modelCreditAccount.findUnique({ where: { organizationId: result.organizationId } }),
    ).resolves.not.toBeNull();
  });

  it("runs a customer on the deployment's model and credit, and fixes one made before that was so", async () => {
    const partner = await newPartner("mode");
    const input = { externalTenantId: "shop-mode", name: "Shop Mode" };
    const first = await provisionPartnerTenant(db, partner, input);
    remember(first);
    const mode = () =>
      db.modelCreditAccount
        .findUniqueOrThrow({ where: { organizationId: first.organizationId } })
        .then((account) => account.mode);
    await expect(mode()).resolves.toBe("credits");
    await db.modelCreditAccount.update({
      where: { organizationId: first.organizationId },
      data: { mode: null },
    });
    await provisionPartnerTenant(db, partner, input);
    await expect(mode()).resolves.toBe("credits");
  });

  it("returns the same customer when asked again", async () => {
    const partner = await newPartner("again");
    const input = { externalTenantId: "shop-2", name: "Shop Two" };
    const first = await provisionPartnerTenant(db, partner, input);
    remember(first);
    const second = await provisionPartnerTenant(db, partner, input);
    expect(second).toMatchObject({
      tenantId: first.tenantId,
      organizationId: first.organizationId,
      spaceId: first.spaceId,
      ownerUserId: first.ownerUserId,
      created: false,
    });
  });

  it("makes one customer, not two, when two requests arrive together", async () => {
    const partner = await newPartner("race");
    const input = { externalTenantId: "shop-3", name: "Shop Three" };
    const results = await Promise.all([
      provisionPartnerTenant(db, partner, input),
      provisionPartnerTenant(db, partner, input),
      provisionPartnerTenant(db, partner, input),
    ]);
    remember(results[0]!);
    expect(new Set(results.map((r) => r.organizationId)).size).toBe(1);
    expect(new Set(results.map((r) => r.ownerUserId)).size).toBe(1);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    await expect(
      db.partnerTenant.count({ where: { partnerId: partner.id, externalTenantId: "shop-3" } }),
    ).resolves.toBe(1);
    await expect(
      db.member.count({ where: { organizationId: results[0]!.organizationId } }),
    ).resolves.toBe(1);
  });

  it("keeps two partners' customers apart even when they share an id", async () => {
    const a = await newPartner("pa");
    const b = await newPartner("pb");
    const input = { externalTenantId: "shop-4", name: "Same Id" };
    const first = await provisionPartnerTenant(db, a, input);
    const second = await provisionPartnerTenant(db, b, input);
    remember(first);
    remember(second);
    expect(first.organizationId).not.toBe(second.organizationId);
    expect(first.ownerUserId).not.toBe(second.ownerUserId);
    await expect(findPartnerTenant(db, b.id, "shop-4")).resolves.toMatchObject({
      organizationId: second.organizationId,
    });
  });

  it("gives the owner an address nobody can write to, so it never meets a real account", async () => {
    const partner = await newPartner("mail");
    const result = await provisionPartnerTenant(db, partner, {
      externalTenantId: "shop-5",
      name: "Shop Five",
    });
    remember(result);
    const owner = await db.user.findUniqueOrThrow({ where: { id: result.ownerUserId } });
    expect(owner.email).toMatch(/@partner\.invalid$/);
    expect(owner.emailVerified).toBe(true);
  });

  it("tells a customer's space its state, and a space of no partner customer nothing", async () => {
    const partner = await newPartner("susp");
    const result = await provisionPartnerTenant(db, partner, {
      externalTenantId: "shop-6",
      name: "Shop Six",
    });
    remember(result);
    await expect(partnerSpaceState(db, result.spaceId)).resolves.toBe("enabled");
    await expect(setPartnerTenantState(db, partner.id, "shop-6", "suspended")).resolves.toBe(true);
    await expect(partnerSpaceState(db, result.spaceId)).resolves.toBe("suspended");
    await expect(setPartnerTenantState(db, partner.id, "shop-6", "enabled")).resolves.toBe(true);
    await expect(partnerSpaceState(db, result.spaceId)).resolves.toBe("enabled");
    await expect(partnerSpaceState(db, "no-such-space")).resolves.toBeNull();
  });

  it("does not find another partner's customer, and says so when changing one that is not there", async () => {
    const a = await newPartner("na");
    const b = await newPartner("nb");
    const result = await provisionPartnerTenant(db, a, {
      externalTenantId: "shop-7",
      name: "Shop Seven",
    });
    remember(result);
    await expect(findPartnerTenant(db, b.id, "shop-7")).resolves.toBeNull();
    await expect(setPartnerTenantState(db, b.id, "shop-7", "suspended")).resolves.toBe(false);
    await expect(findPartnerTenant(db, a.id, "shop-7")).resolves.toMatchObject({
      state: "enabled",
    });
  });
});
