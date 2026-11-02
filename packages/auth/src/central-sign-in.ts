import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, createAuthMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 64 * 1024;
/** How long a freshly signed-in person may take to give their name before the proof is dropped. */
const PENDING_NAME_TTL_MS = 15 * 60_000;

export const CENTRAL_SESSION_SECONDS = 30 * 24 * 60 * 60;

interface CentralUser {
  id: string;
  email: string;
  name?: string | null;
}

interface CentralSession {
  token: string;
  user: CentralUser;
}

export interface CentralSignInOptions {
  /** Origin of the Corvo server that owns accounts. Everything else here is a mirror of it. */
  url: string;
  fetch?: typeof fetch;
}

const EMAIL = /^[^\s@]+@[^\s@]+$/;
const CODE = /^\d{4,10}$/;

function text(value: unknown, max = 320): string {
  return typeof value === "string" && value.length <= max ? value.trim() : "";
}

/**
 * Sign-in for an engine that runs on one person's computer but whose accounts live on a central
 * Corvo server. The person sees the usual email-and-code form; this plugin answers the same two
 * endpoints by asking the central server to send and check the code, and on success mirrors the
 * account locally and opens a local session. The central server stays the one place that knows
 * who has an account, and a local session keeps working offline until it expires.
 */
export function centralSignIn(options: CentralSignInOptions): BetterAuthPlugin {
  const base = options.url.replace(/\/+$/, "");
  const call = options.fetch ?? fetch;
  /** Central sessions waiting for the person's name, by local user id. Dropped once used. */
  const pendingName = new Map<string, { token: string; expires: number }>();

  async function request(path: string, init: { body?: unknown; token?: string }) {
    let response: Response;
    try {
      response = await call(`${base}/api/auth${path}`, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          "content-type": "application/json",
          // The central server checks the Origin of browser-style posts.
          origin: base,
          ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        },
        body: JSON.stringify(init.body ?? {}),
      });
    } catch {
      throw new APIError("SERVICE_UNAVAILABLE", { message: "Could not reach the server" });
    }
    const text = await boundedText(response);
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { response, json: json as Record<string, unknown> | null };
  }

  async function signOutCentral(token: string) {
    await request("/sign-out", { token }).catch(() => undefined);
  }

  return {
    id: "central-sign-in",
    endpoints: {
      sendCentralCode: createAuthEndpoint(
        "/email-otp/send-verification-otp",
        { method: "POST" },
        async (ctx) => {
          const email = text(ctx.body?.email).toLowerCase();
          if (!EMAIL.test(email) || ctx.body?.type !== "sign-in") {
            throw new APIError("BAD_REQUEST", { message: "Invalid email" });
          }
          const { response, json } = await request(ctx.path, { body: { email, type: "sign-in" } });
          if (response.status >= 500 || response.status === 429) {
            throw new APIError(
              response.status === 429 ? "TOO_MANY_REQUESTS" : "SERVICE_UNAVAILABLE",
              {
                message: String(json?.message ?? "Could not send the code"),
              },
            );
          }
          // The central server answers the same for known and unknown addresses; so do we.
          return ctx.json({ success: true });
        },
      ),
      signInWithCentralCode: createAuthEndpoint(
        "/sign-in/email-otp",
        { method: "POST" },
        async (ctx) => {
          const email = text(ctx.body?.email).toLowerCase();
          const otp = text(ctx.body?.otp, 10);
          if (!EMAIL.test(email) || !CODE.test(otp)) {
            throw new APIError("BAD_REQUEST", { code: "INVALID_OTP", message: "Invalid OTP" });
          }
          const { response, json } = await request("/sign-in/email-otp", {
            body: { email, otp, name: text(ctx.body?.name, 200) || undefined },
          });
          const central = parseSession(json);
          if (!response.ok || !central) {
            if (response.status >= 500) {
              throw new APIError("SERVICE_UNAVAILABLE", { message: "Could not reach the server" });
            }
            throw new APIError(response.status === 429 ? "TOO_MANY_REQUESTS" : "BAD_REQUEST", {
              code: String(json?.code ?? "INVALID_OTP"),
              message: String(json?.message ?? "Invalid OTP"),
            });
          }

          const adapter = ctx.context.internalAdapter;
          const name = central.user.name?.trim() ?? "";
          let user = (await adapter.findUserByEmail(email))?.user ?? null;
          if (!user) {
            user = await adapter.createUser(
              { email, name, emailVerified: true },
              { method: "email-otp" },
            );
          } else if (name && user.name !== name) {
            user = (await adapter.updateUser(user.id, { name, emailVerified: true })) ?? user;
          } else if (!user.emailVerified) {
            user = (await adapter.updateUser(user.id, { emailVerified: true })) ?? user;
          }

          if (!name && user.name.trim()) {
            // The account was named here before the central server learned of it.
            await request("/update-user", { token: central.token, body: { name: user.name } });
            await signOutCentral(central.token);
          } else if (!name) {
            pendingName.set(user.id, {
              token: central.token,
              expires: Date.now() + PENDING_NAME_TTL_MS,
            });
          } else {
            await signOutCentral(central.token);
          }

          const session = await adapter.createSession(user.id);
          if (!session)
            throw new APIError("INTERNAL_SERVER_ERROR", { message: "Could not sign in" });
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ token: session.token, user });
        },
      ),
    },
    hooks: {
      after: [
        {
          // The name given after the first code belongs to the central account too.
          matcher: (ctx) => ctx.path === "/update-user",
          handler: createAuthMiddleware(async (ctx) => {
            const userId = ctx.context.newSession?.user.id ?? ctx.context.session?.user.id;
            const name = typeof ctx.body?.name === "string" ? ctx.body.name.trim() : "";
            const pending = userId ? pendingName.get(userId) : undefined;
            if (!userId || !pending || !name) return;
            pendingName.delete(userId);
            if (pending.expires < Date.now()) {
              await signOutCentral(pending.token);
              return;
            }
            await request("/update-user", { token: pending.token, body: { name } });
            await signOutCentral(pending.token);
          }),
        },
      ],
    },
  };
}

function parseSession(json: Record<string, unknown> | null): CentralSession | null {
  const user = json?.user as Partial<CentralUser> | undefined;
  if (typeof json?.token !== "string" || typeof user?.email !== "string") return null;
  return {
    token: json.token,
    user: { id: String(user.id ?? ""), email: user.email, name: user.name ?? null },
  };
}

async function boundedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      return "";
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
