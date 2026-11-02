import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { LOCAL_ENTRY_PATH, mountLocalEntryRoute } from "./local-entry.js";

describe("the local entry route", () => {
  it("returns the session the auth service opened", async () => {
    const app = new Hono();
    mountLocalEntryRoute(app, {
      enter: async () =>
        new Response('{"ok":true}', { status: 200, headers: { "set-cookie": "session=abc" } }),
    });
    const response = await app.request(LOCAL_ENTRY_PATH);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBe("session=abc");
  });

  it("gives every refusal the same plain answer, without a cookie", async () => {
    const app = new Hono();
    mountLocalEntryRoute(app, {
      enter: async () => new Response('{"message":"why"}', { status: 401 }),
    });
    const response = await app.request(LOCAL_ENTRY_PATH);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("passes the caller's headers on so the token can be checked", async () => {
    const enter = vi.fn(async () => new Response("{}", { status: 200 }));
    const app = new Hono();
    mountLocalEntryRoute(app, { enter });
    await app.request(LOCAL_ENTRY_PATH, { headers: { "x-test": "1" } });
    expect(enter.mock.calls[0]?.[0].headers.get("x-test")).toBe("1");
  });
});
