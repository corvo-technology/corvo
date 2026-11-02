import { createHash } from "node:crypto";
import type { Hono } from "hono";
import { readBoundedBody } from "./http-body.js";

export const PARTNER_ENTRY_PATH = "/api/partner/enter";

export const hashEntryCode = (code: string): string =>
  createHash("sha256").update(code).digest("hex");

/**
 * The link a partner's system hands to a customer's person. The auth service spends the code and
 * opens the session; this only passes the request through and returns its redirect and cookie.
 */
export function mountPartnerEntryRoute(
  app: Hono,
  deps: {
    enter(input: { code: string; headers: Headers }): Promise<Response>;
  },
): void {
  app.get(PARTNER_ENTRY_PATH, (c) =>
    deps.enter({ code: c.req.query("code") ?? "", headers: c.req.raw.headers }),
  );
}

export const PARTNER_EMBED_EXCHANGE_PATH = "/api/partner/embed/exchange";
const EMBED_BODY_MAX_BYTES = 4096;

/**
 * Where the embedded frame trades its one-use code for a session token. The auth service opens
 * the session and signs the token; this keeps only the token (never a cookie, which the frame
 * could not keep) and the expiry in the answer. Every refusal is the same answer.
 */
export function mountPartnerEmbedRoute(
  app: Hono,
  deps: { exchange(input: { code: string; headers: Headers }): Promise<Response> },
): void {
  app.post(PARTNER_EMBED_EXCHANGE_PATH, async (c) => {
    const headers = { "cache-control": "no-store", "referrer-policy": "no-referrer" };
    const refuse = () => c.json({ error: "Invalid code" }, 401, headers);
    const raw = await readBoundedBody(c.req.raw, EMBED_BODY_MAX_BYTES);
    if (raw === null) return c.json({ error: "Payload too large" }, 413, headers);
    let code = "";
    try {
      const parsed = JSON.parse(raw) as { code?: unknown };
      code = typeof parsed.code === "string" ? parsed.code : "";
    } catch {
      return c.json({ error: "Invalid JSON" }, 400, headers);
    }
    if (!code) return refuse();
    const response = await deps.exchange({ code, headers: c.req.raw.headers });
    const token = response.headers.get("set-auth-token");
    if (!response.ok || !token) return refuse();
    const { expiresAt } = (await response.json()) as { expiresAt?: string };
    return c.json({ token, expiresAt: expiresAt ?? null }, 200, headers);
  });
}
