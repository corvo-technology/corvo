import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { grantPartnerAllowance } from "./partner-allowance.js";
import { provisionPartnerTenant } from "./partner-tenants.js";
import { giveWallet } from "./partner-wallet.test-support.js";
import { createPartner } from "./partners.js";
import { asSystem } from "./row-security.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("partner monthly allowance (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  let prisma: PrismaClient;
  let db: PrismaClient;
  let close: () => Promise<void>;
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  const partnerIds: string[] = [];

  async function tenant(label: string) {
    const { partner } = await createPartner(db, { slug: `acme-${label}-${suffix}`, name: label });
    partnerIds.push(partner.id);
    const wallet = await giveWallet(db, partner.id, `${label}-${suffix}`, 100_000);
    organizationIds.push(wallet.organizationId);
    userIds.push(wallet.userId);
    const result = await provisionPartnerTenant(db, partner, {
      externalTenantId: `shop-${label}`,
      name: label,
    });
    organizationIds.push(result.organizationId);
    userIds.push(result.ownerUserId);
    return {
      organizationId: result.organizationId,
      partnerId: partner.id,
      externalTenantId: `shop-${label}`,
    };
  }
  const balance = async (organizationId: string) =>
    (await db.modelCreditAccount.findUniqueOrThrow({ where: { organizationId } })).balanceMicros;

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

  // A period far enough ahead that it is still running whenever this test runs.
  const period = "2099-06";

  it("adds the allowance once, however often it is granted in a period", async () => {
    const t = await tenant("once");
    await expect(grantPartnerAllowance(db, t, { amountCents: 1000, period })).resolves.toEqual({
      addedCents: 1000,
    });
    await expect(grantPartnerAllowance(db, t, { amountCents: 1000, period })).resolves.toEqual({
      addedCents: 0,
    });
    await expect(balance(t.organizationId)).resolves.toBe(10_000_000n);
  });

  it("adds a new allowance for a new period", async () => {
    const t = await tenant("next");
    await grantPartnerAllowance(db, t, { amountCents: 1000, period: "2099-06" });
    await expect(
      grantPartnerAllowance(db, t, { amountCents: 1000, period: "2099-07" }),
    ).resolves.toEqual({ addedCents: 1000 });
    await expect(balance(t.organizationId)).resolves.toBe(20_000_000n);
  });

  it("adds only the difference when the amount is raised, and never takes credit back when lowered", async () => {
    const t = await tenant("raise");
    await grantPartnerAllowance(db, t, { amountCents: 1000, period });
    await expect(grantPartnerAllowance(db, t, { amountCents: 2500, period })).resolves.toEqual({
      addedCents: 1500,
    });
    await expect(grantPartnerAllowance(db, t, { amountCents: 2500, period })).resolves.toEqual({
      addedCents: 0,
    });
    await expect(grantPartnerAllowance(db, t, { amountCents: 500, period })).resolves.toEqual({
      addedCents: 0,
    });
    await expect(balance(t.organizationId)).resolves.toBe(25_000_000n);
  });

  it("does not count an allowance that has already expired", async () => {
    const t = await tenant("old");
    await grantPartnerAllowance(db, t, { amountCents: 1000, period: "2020-01" });
    await expect(balance(t.organizationId)).resolves.toBe(0n);
  });

  it("keeps one customer's allowance out of another's, even for the same period and amount", async () => {
    const a = await tenant("ia");
    const b = await tenant("ib");
    await grantPartnerAllowance(db, a, { amountCents: 1000, period });
    await expect(balance(b.organizationId)).resolves.toBe(0n);
    await grantPartnerAllowance(db, b, { amountCents: 1000, period });
    await expect(balance(a.organizationId)).resolves.toBe(10_000_000n);
    await expect(balance(b.organizationId)).resolves.toBe(10_000_000n);
  });

  it("refuses an amount that is not a whole positive number of cents and a period that is not a month", async () => {
    const t = await tenant("bad");
    await expect(grantPartnerAllowance(db, t, { amountCents: 0, period })).rejects.toThrow();
    await expect(grantPartnerAllowance(db, t, { amountCents: -5, period })).rejects.toThrow();
    await expect(grantPartnerAllowance(db, t, { amountCents: 10.5, period })).rejects.toThrow();
    await expect(
      grantPartnerAllowance(db, t, { amountCents: 100, period: "June 2099" }),
    ).rejects.toThrow();
    await expect(
      grantPartnerAllowance(db, t, { amountCents: 100, period: "2099-13" }),
    ).rejects.toThrow();
  });
});
