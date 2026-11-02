import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { mountPartnerEmbedRoute } from "./partner-entry.js";

function setup(exchange: (input: { code: string; headers: Headers }) => Promise<Response>) {
  const app = new Hono();
  const spy = vi.fn(exchange);
  mountPartnerEmbedRoute(app, { exchange: spy });
  const post = (body: string, headers: Record<string, string> = {}) =>
    app.request("/api/partner/embed/exchange", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
    });
  return { post, spy };
}

const ok = () =>
  new Response(JSON.stringify({ expiresAt: "2030-01-01T08:00:00.000Z" }), {
    headers: {
      "content-type": "application/json",
      "set-auth-token": "signed.token.value",
      "set-cookie": "better-auth.session_token=cookie-value; HttpOnly",
    },
  });

describe("partner embed exchange route", () => {
  it("hands back the session token and its expiry, and no cookie", async () => {
    const { post } = setup(async () => ok());
    const res = await post(JSON.stringify({ code: "one-use-code" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      token: "signed.token.value",
      expiresAt: "2030-01-01T08:00:00.000Z",
    });
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("passes the code to the auth service and nothing else of the request body", async () => {
    const { post, spy } = setup(async () => ok());
    await post(JSON.stringify({ code: "abc", extra: "ignored" }));
    expect(spy).toHaveBeenCalledWith({ code: "abc", headers: expect.any(Headers) });
  });

  it("answers every refusal the same way", async () => {
    const refused = () =>
      new Response(JSON.stringify({ message: "Invalid code" }), { status: 401 });
    const { post } = setup(async () => refused());
    const bodies: string[] = [];
    for (const body of [
      JSON.stringify({ code: "expired" }),
      JSON.stringify({ code: "" }),
      JSON.stringify({}),
    ]) {
      const res = await post(body);
      expect(res.status).toBe(401);
      bodies.push(await res.text());
    }
    expect(new Set(bodies).size).toBe(1);
  });

  it("refuses a success that carries no token", async () => {
    const { post } = setup(
      async () => new Response("{}", { headers: { "content-type": "application/json" } }),
    );
    expect((await post(JSON.stringify({ code: "x" }))).status).toBe(401);
  });

  it("rejects malformed and oversized bodies before asking the auth service", async () => {
    const { post, spy } = setup(async () => ok());
    expect((await post("{not json")).status).toBe(400);
    expect((await post(JSON.stringify({ code: "x".repeat(20_000) }))).status).toBe(413);
    expect(spy).not.toHaveBeenCalled();
  });

  it("never lets the code appear in a response", async () => {
    const { post } = setup(async () => ok());
    const res = await post(JSON.stringify({ code: "secret-code-value" }));
    expect(await res.text()).not.toContain("secret-code-value");
  });
});
