import { describe, expect, it, vi } from "vitest";
import { runPartnerDemo } from "./partner-demo-command.js";

const env = {
  PARTNER_API_URL: "https://corvo.example.test",
  PARTNER_API_KEY: "cpk_DEMOKEY1.demo-secret-not-printed",
};

function fakeFetch() {
  const calls: Array<{ method: string; url: string; body: unknown; auth: string | null }> = [];
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({
      method: init?.method ?? "GET",
      url: String(url),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      auth: headers.get("authorization"),
    });
    return String(url).endsWith("/sessions")
      ? Response.json({
          url: "https://app.example.test/api/partner/enter?code=abc",
          expiresAt: "2026-11-05T12:01:00.000Z",
        })
      : Response.json({ tenantId: "t1", created: true });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

describe("runPartnerDemo", () => {
  it("creates a customer with a connector, two agents and an allowance, then asks for a link", async () => {
    const { fetchFn, calls } = fakeFetch();
    const output = await runPartnerDemo(env, fetchFn);
    expect(calls.map((c) => `${c.method} ${new URL(c.url).pathname}`)).toEqual([
      "PUT /api/partner/v1/tenants/demo-shop",
      "POST /api/partner/v1/sessions",
    ]);
    expect(calls.every((c) => c.auth === `Bearer ${env.PARTNER_API_KEY}`)).toBe(true);
    const tenant = calls[0]?.body as {
      agents: unknown[];
      connector: unknown;
      allowanceCents: number;
    };
    expect(tenant.agents).toHaveLength(2);
    expect(tenant.connector).toBeDefined();
    expect(tenant.allowanceCents).toBeGreaterThan(0);
    expect(output).toContain("https://app.example.test/api/partner/enter?code=abc");
  });

  it("never prints the partner key or the connector token", async () => {
    const { fetchFn } = fakeFetch();
    const output = await runPartnerDemo(
      { ...env, DEMO_CONNECTOR_TOKEN: "connector-secret-xyz" },
      fetchFn,
    );
    expect(output).not.toContain("demo-secret-not-printed");
    expect(output).not.toContain("connector-secret-xyz");
  });

  it("stops with a clear message when the address or key is missing, before any request", async () => {
    const { fetchFn, calls } = fakeFetch();
    await expect(runPartnerDemo({}, fetchFn)).rejects.toThrow(/PARTNER_API_URL/);
    await expect(runPartnerDemo({ PARTNER_API_URL: env.PARTNER_API_URL }, fetchFn)).rejects.toThrow(
      /PARTNER_API_KEY/,
    );
    expect(calls).toHaveLength(0);
  });

  it("reports a refusal with its status and not the response body", async () => {
    const fetchFn = vi.fn(
      async () => new Response("secret detail", { status: 401 }),
    ) as unknown as typeof fetch;
    const error = await runPartnerDemo(env, fetchFn).catch((e: unknown) => e as Error);
    expect(error.message).toContain("401");
    expect(error.message).not.toContain("secret detail");
  });
});
