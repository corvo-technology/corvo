import { describe, expect, it, vi } from "vitest";
import { createEmbedDemo } from "./partner-embed-demo-command.js";

const env = {
  PARTNER_API_URL: "https://corvo.example.test",
  PARTNER_API_KEY: "cpk_DEMOKEY1.demo-secret-not-shown",
  CORVO_WEB_URL: "https://app.corvo.example.test",
};

function fakeCorvo() {
  const calls: Array<{ method: string; path: string; body: unknown; auth: string | null }> = [];
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    calls.push({
      method: init?.method ?? "GET",
      path,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      auth: new Headers(init?.headers).get("authorization"),
    });
    return path.endsWith("/sessions")
      ? Response.json({ url: "https://x/enter?code=zzz", code: "one-use-code", expiresAt: "t" })
      : Response.json({ tenantId: "t1", created: true });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

describe("embed demo partner", () => {
  it("serves a page that loads the SDK from Corvo and embeds the assistant", async () => {
    const demo = createEmbedDemo(env, fakeCorvo().fetchFn);
    const res = await demo(new Request("http://localhost:4310/"));
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<script src="https://app.corvo.example.test/sdk.js">');
    expect(html).toContain('<corvo-assistant session-url="/corvo/session"');
    expect(html).not.toContain("demo-secret-not-shown");
  });

  it("creates the demo customer and returns only a one-use code to the browser", async () => {
    const { fetchFn, calls } = fakeCorvo();
    const demo = createEmbedDemo(env, fetchFn);
    const res = await demo(new Request("http://localhost:4310/corvo/session", { method: "POST" }));
    expect(await res.json()).toEqual({ code: "one-use-code" });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "PUT /api/partner/v1/tenants/demo-shop",
      "POST /api/partner/v1/sessions",
    ]);
    expect(calls.every((c) => c.auth === `Bearer ${env.PARTNER_API_KEY}`)).toBe(true);
    expect(calls[1]?.body).toMatchObject({
      externalTenantId: "demo-shop",
      externalUserId: "demo-user",
    });
  });

  it("does not repeat the customer setup on every code", async () => {
    const { fetchFn, calls } = fakeCorvo();
    const demo = createEmbedDemo(env, fetchFn);
    for (let i = 0; i < 3; i++)
      await demo(new Request("http://localhost/corvo/session", { method: "POST" }));
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(1);
    expect(calls.filter((c) => c.path.endsWith("/sessions"))).toHaveLength(3);
  });

  it("answers 502 without detail when Corvo refuses", async () => {
    const fetchFn = vi.fn(
      async () => new Response("secret detail", { status: 401 }),
    ) as unknown as typeof fetch;
    const demo = createEmbedDemo(env, fetchFn);
    const res = await demo(new Request("http://localhost/corvo/session", { method: "POST" }));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("secret detail");
  });

  it("knows no other route, and wants an address and a key", async () => {
    const demo = createEmbedDemo(env, fakeCorvo().fetchFn);
    expect((await demo(new Request("http://localhost/other"))).status).toBe(404);
    expect((await demo(new Request("http://localhost/corvo/session"))).status).toBe(404);
    expect(() => createEmbedDemo({}, fetch)).toThrow(/PARTNER_API_URL/);
    expect(() => createEmbedDemo({ PARTNER_API_URL: "https://x" }, fetch)).toThrow(
      /PARTNER_API_KEY/,
    );
  });
});
