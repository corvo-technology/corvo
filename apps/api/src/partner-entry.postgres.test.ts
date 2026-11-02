import { createAuth } from "@corvo/auth";
import type { PrismaClient } from "@corvo/db";
import {
  asSystem,
  consumePartnerEntryCode,
  createDb,
  createPartner,
  installSecurityEventStore,
  provisionPartnerTenant,
  setPartnerTenantState,
} from "@corvo/db";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashEntryCode, mountPartnerEmbedRoute, mountPartnerEntryRoute } from "./partner-entry.js";

const dbTests =
  process.env.VERIFY_DATABASE && process.env.DATABASE_URL ? describe.sequential : describe.skip;

dbTests("partner entry endpoint", () => {
  const stamp = `${process.pid}-${Date.now()}`;
  const webOrigin = "https://app.example.test";
  let db: ReturnType<typeof createDb>;
  let prisma: PrismaClient;
  let app: Hono;
  let auth: ReturnType<typeof createAuth>;
  const partnerIds: string[] = [];
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  let counter = 0;

  async function code(options: { expiresInMs?: number } = {}) {
    const label = `n${++counter}-${stamp}`;
    const { partner } = await createPartner(prisma, { slug: `acme-${label}`, name: label });
    partnerIds.push(partner.id);
    const tenant = await provisionPartnerTenant(prisma, partner, {
      externalTenantId: label,
      name: label,
    });
    organizationIds.push(tenant.organizationId);
    userIds.push(tenant.ownerUserId);
    const value = `entry-code-${label}-${"x".repeat(30)}`;
    await prisma.partnerEntryCode.create({
      data: {
        codeHash: hashEntryCode(value),
        partnerId: partner.id,
        tenantId: tenant.tenantId,
        externalUserId: "u1",
        expiresAt: new Date(Date.now() + (options.expiresInMs ?? 60_000)),
      },
    });
    return { value, partner, tenant, label };
  }
  const enter = (value: string) =>
    app.request(`/api/partner/enter?code=${encodeURIComponent(value)}`, { redirect: "manual" });
  const sessionsOf = (userId: string) => prisma.session.count({ where: { userId } });

  beforeAll(() => {
    db = createDb(process.env.DATABASE_URL!);
    prisma = asSystem(db.prisma);
    installSecurityEventStore(prisma);
    auth = createAuth(db.prisma, {
      secret: "offline-auth-secret-at-least-32-characters",
      baseURL: "https://api.example.test",
      webOrigin,
      signupsEnabled: "false",
      signupAllowlist: "",
      partnerEntry: { consume: (value) => consumePartnerEntryCode(prisma, hashEntryCode(value)) },
    });
    app = new Hono();
    mountPartnerEmbedRoute(app, {
      exchange: ({ code: value, headers }) =>
        (
          auth.api as unknown as {
            partnerEmbedExchange(input: unknown): Promise<Response>;
          }
        ).partnerEmbedExchange({ body: { code: value }, headers, asResponse: true }),
    });
    mountPartnerEntryRoute(app, {
      enter: ({ code: value, headers }) =>
        (
          auth.api as unknown as {
            partnerEnter(input: unknown): Promise<Response>;
          }
        ).partnerEnter({ query: { code: value }, headers, asResponse: true }),
    });
  });
  afterAll(async () => {
    await prisma.partner.deleteMany({ where: { id: { in: partnerIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    installSecurityEventStore(undefined);
    await db.prisma.$disconnect();
    await db.pool.end();
  });

  it("opens one session and sends the person into the app without the code in the address", async () => {
    const c = await code();
    const res = await enter(c.value);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toBe(`${webOrigin}/app`);
    expect(res.headers.get("location")).not.toContain(c.value);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    await expect(sessionsOf(c.tenant.ownerUserId)).resolves.toBe(1);
  });

  it("sets a session cookie that scripts cannot read, is Secure on https and Lax across sites", async () => {
    const c = await code();
    const res = await enter(c.value);
    const cookie = res.headers.getSetCookie().find((line) => line.includes("session_token")) ?? "";
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toContain(c.value);
  });

  it("gives one session, not two, for a second use and for simultaneous uses", async () => {
    const a = await code();
    await enter(a.value);
    const again = await enter(a.value);
    expect(again.headers.get("location")).toBe(webOrigin);
    await expect(sessionsOf(a.tenant.ownerUserId)).resolves.toBe(1);

    const b = await code();
    await Promise.all(Array.from({ length: 6 }, () => enter(b.value)));
    await expect(sessionsOf(b.tenant.ownerUserId)).resolves.toBe(1);
  });

  it("refuses an expired code, a made-up code and a suspended customer in the same way, with no cookie", async () => {
    const expired = await code({ expiresInMs: -1000 });
    const suspended = await code();
    await setPartnerTenantState(prisma, suspended.partner.id, suspended.label, "suspended");
    const responses = await Promise.all([
      enter(expired.value),
      enter("made-up-code"),
      enter(suspended.value),
      enter(""),
    ]);
    for (const res of responses) {
      expect(res.status).toBe(responses[0]?.status);
      expect(res.headers.get("location")).toBe(webOrigin);
      expect(res.headers.getSetCookie()).toEqual([]);
    }
    await expect(sessionsOf(expired.tenant.ownerUserId)).resolves.toBe(0);
    await expect(sessionsOf(suspended.tenant.ownerUserId)).resolves.toBe(0);
  });

  it("records the sign-in as coming through a partner, without the code", async () => {
    const c = await code();
    await enter(c.value);
    const events = await prisma.securityEvent.findMany({
      where: { userId: c.tenant.ownerUserId, type: "auth.sign_in" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.metadata).toMatchObject({ via: "/partner/enter" });
    expect(JSON.stringify(events[0])).not.toContain(c.value);
  });

  const exchange = (value: string) =>
    app.request("/api/partner/embed/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: value }),
    });

  it("trades a code for a token that signs the customer in without any cookie", async () => {
    const c = await code();
    const res = await exchange(c.value);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    const { token, expiresAt } = (await res.json()) as { token: string; expiresAt: string };
    expect(token.length).toBeGreaterThan(20);
    // The frame renews its code before this; the session itself then lives and refreshes like any
    // other, which is why the check below is on the signed-in person and not on the stored expiry.
    const hours = (Date.parse(expiresAt) - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(7.9);
    expect(hours).toBeLessThanOrEqual(8);
    const me = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${token}` }),
    });
    expect(me?.user.id).toBe(c.tenant.ownerUserId);
  });

  it("refuses a used, expired or made-up code in the same way", async () => {
    const used = await code();
    await exchange(used.value);
    const expired = await code({ expiresInMs: -1000 });
    const suspended = await code();
    await setPartnerTenantState(prisma, suspended.partner.id, suspended.label, "suspended");
    const bodies: string[] = [];
    for (const value of [used.value, expired.value, "made-up", suspended.value]) {
      const res = await exchange(value);
      expect(res.status).toBe(401);
      bodies.push(await res.text());
    }
    expect(new Set(bodies).size).toBe(1);
    await expect(sessionsOf(expired.tenant.ownerUserId)).resolves.toBe(0);
    await expect(sessionsOf(suspended.tenant.ownerUserId)).resolves.toBe(0);
  });

  it("gives one token, not several, when the same code is sent at once", async () => {
    const c = await code();
    const results = await Promise.all(Array.from({ length: 6 }, () => exchange(c.value)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    await expect(sessionsOf(c.tenant.ownerUserId)).resolves.toBe(1);
  });

  it("records the sign-in as coming through the embed", async () => {
    const c = await code();
    await exchange(c.value);
    const events = await prisma.securityEvent.findMany({
      where: { userId: c.tenant.ownerUserId, type: "auth.sign_in" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.metadata).toMatchObject({ via: "/partner/embed" });
  });
});
