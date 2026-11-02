import type { BillingProvider } from "@corvo/adapter-kit";
import type { Actor } from "@corvo/contracts";
import type { PrismaClient } from "@corvo/db";
import { describe, expect, it, vi } from "vitest";
import { createBillingService } from "./billing.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user@corvo.test",
  isDeploymentOwner: false,
};
const price = { amount: 1000, currency: "usd", interval: "month" as const, intervalCount: 1 };

function service(getPrice: BillingProvider["getPrice"], role = "owner") {
  const prisma = {
    space: { findUnique: vi.fn().mockResolvedValue({ organizationId: "org-1" }) },
    member: {
      findUnique: vi.fn().mockResolvedValue({ role }),
      count: vi.fn().mockResolvedValue(3),
    },
    billingAccount: { findUnique: vi.fn().mockResolvedValue(null) },
  } as unknown as PrismaClient;
  const provider = {
    describe: () => ({ capabilities: { trials: true, portal: true } }),
    getPrice: vi.fn(getPrice),
  } as unknown as BillingProvider;
  return {
    provider,
    billing: createBillingService({ prisma, provider, webOrigin: "https://app.example.com" }),
  };
}

describe("billing status", () => {
  it("reads the price once and reuses it", async () => {
    const { billing, provider } = service(async () => price);
    await expect(billing.status(actor)).resolves.toMatchObject({ price, seats: 3 });
    await billing.status(actor);
    expect(provider.getPrice).toHaveBeenCalledTimes(1);
  });

  it("still answers when the price cannot be read", async () => {
    const { billing } = service(async () => {
      throw new Error("provider unavailable");
    });
    await expect(billing.status(actor)).resolves.toMatchObject({ price: null, access: false });
  });

  it("refuses checkout and portal for non-owners", async () => {
    const { billing } = service(async () => price, "member");
    await expect(billing.checkout(actor)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(billing.portal(actor)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("free trial", () => {
  function seatPlan(trialDays?: number | null) {
    const prisma = {
      space: { findUnique: vi.fn().mockResolvedValue({ organizationId: "org-1" }) },
      member: {
        findUnique: vi.fn().mockResolvedValue({ role: "owner" }),
        count: vi.fn().mockResolvedValue(3),
      },
      billingAccount: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({
          organizationId: "org-1",
          customerId: "cus_1",
          status: null,
          subscribedAt: null,
        }),
      },
    } as unknown as PrismaClient;
    const provider = {
      describe: () => ({ capabilities: { trials: true, portal: true } }),
      getPrice: vi.fn(async () => price),
      createCustomer: vi.fn(async () => ({ customerId: "cus_1" })),
      createCheckout: vi.fn(async () => ({ url: "https://pay.example.com" })),
    } as unknown as BillingProvider;
    return {
      provider,
      billing: createBillingService({
        prisma,
        provider,
        webOrigin: "https://app.example.com",
        ...(trialDays === undefined ? {} : { trialDays }),
      }),
    };
  }

  it("is not offered by default", async () => {
    const { billing } = seatPlan();
    await expect(billing.status(actor)).resolves.toMatchObject({
      trialAvailable: false,
      trialDays: 0,
    });
  });

  it("is not sent to checkout by default, so the first charge is immediate", async () => {
    const { billing, provider } = seatPlan();
    await billing.checkout(actor);
    expect(provider.createCheckout).toHaveBeenCalledOnce();
    expect(vi.mocked(provider.createCheckout).mock.calls[0]?.[0]).not.toHaveProperty("trialDays");
  });

  it("is offered and sent when days are configured", async () => {
    const { billing, provider } = seatPlan(7);
    await expect(billing.status(actor)).resolves.toMatchObject({
      trialAvailable: true,
      trialDays: 7,
    });
    await billing.checkout(actor);
    expect(provider.createCheckout).toHaveBeenCalledWith(expect.objectContaining({ trialDays: 7 }));
  });

  it("is never sent as zero days, which Stripe refuses", async () => {
    const { billing, provider } = seatPlan(0);
    await billing.checkout(actor);
    expect(vi.mocked(provider.createCheckout).mock.calls[0]?.[0]).not.toHaveProperty("trialDays");
  });
});
