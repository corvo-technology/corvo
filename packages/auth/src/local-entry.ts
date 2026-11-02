import { createHash, timingSafeEqual } from "node:crypto";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";

/** The one person an engine on their own computer belongs to, when it has no account yet. */
export const LOCAL_OWNER_EMAIL = "owner@local.me";

/** The placeholder earlier versions created the local owner with. */
const LEGACY_LOCAL_OWNER_EMAIL = "owner@local.invalid";

/** An owner created with the old placeholder takes the current one; any other address stays. */
export async function withCurrentOwnerEmail<T extends { id: string; email: string }>(
  adapter: { updateUser: (id: string, data: { email: string }) => Promise<T | null | unknown> },
  user: T,
): Promise<T> {
  if (user.email !== LEGACY_LOCAL_OWNER_EMAIL) return user;
  await adapter.updateUser(user.id, { email: LOCAL_OWNER_EMAIL });
  return { ...user, email: LOCAL_OWNER_EMAIL };
}

export interface LocalEntryOptions {
  /** The private identity the desktop app shares with the engine it starts. */
  token: string;
  /** The request header that carries it. */
  header: string;
}

/** Compares two secrets without leaking where they differ. */
export function localTokenMatches(given: string, expected: string): boolean {
  if (!given || !expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Lets the desktop app into the engine it started on this computer without a sign-in: nobody else
 * shares that engine, so there is no account to prove. The caller must hold the app-private token,
 * which only the app and the engine it spawned know. The session is a normal one, so workspace
 * provisioning and every session hook still apply. An engine that already has a person (one that
 * signed in before accounts were optional) keeps that person and their data. The endpoint is closed
 * to the public auth handler; the API mounts it itself.
 */
export function localEntry(options: LocalEntryOptions): BetterAuthPlugin {
  return {
    id: "local-entry",
    endpoints: {
      localEnter: createAuthEndpoint("/local/enter", { method: "GET" }, async (ctx) => {
        ctx.setHeader("cache-control", "no-store");
        if (!localTokenMatches(ctx.headers?.get(options.header) ?? "", options.token)) {
          throw new APIError("UNAUTHORIZED", { message: "Unauthorized" });
        }
        const adapter = ctx.context.internalAdapter;
        const [oldest] = await ctx.context.adapter.findMany<{ id: string }>({
          model: "user",
          sortBy: { field: "createdAt", direction: "asc" },
          limit: 1,
        });
        const found = oldest ? await adapter.findUserById(oldest.id) : null;
        let user = found ? await withCurrentOwnerEmail(adapter, found) : null;
        if (!user) {
          user = await adapter.createUser(
            { email: LOCAL_OWNER_EMAIL, name: "", emailVerified: true },
            { method: "local" },
          );
        }
        const session = await adapter.createSession(user.id);
        if (!session) throw new APIError("UNAUTHORIZED", { message: "Unauthorized" });
        await setSessionCookie(ctx, { session, user });
        return ctx.json({ ok: true });
      }),
    },
  };
}
