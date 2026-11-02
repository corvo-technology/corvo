import { PARTNER_SESSION_MS } from "@corvo/db";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";

export interface PartnerEntryOptions {
  /** Spends a code atomically and names the person it opens, or null for any code that is not good. */
  consume(code: string): Promise<{ userId: string } | null>;
  webOrigin: string;
}

/**
 * Lets a partner's customer in with a one-use code from the partner's system. It opens a normal
 * session through the same session machinery as every other sign-in, so the session hooks, cookie
 * attributes and security events all apply. Every refusal is the same redirect to the sign-in
 * page, so a code's state is never revealed. The endpoint is closed to the public auth handler:
 * the API mounts it itself.
 */
export function partnerEntry(options: PartnerEntryOptions): BetterAuthPlugin {
  const origin = options.webOrigin.replace(/\/+$/, "");
  return {
    id: "partner-entry",
    endpoints: {
      partnerEnter: createAuthEndpoint("/partner/enter", { method: "GET" }, async (ctx) => {
        // The code is a credential: keep it out of caches and out of any Referer.
        ctx.setHeader("cache-control", "no-store");
        ctx.setHeader("referrer-policy", "no-referrer");
        const code = typeof ctx.query?.code === "string" ? ctx.query.code : "";
        const person = code.length > 0 && code.length <= 200 ? await options.consume(code) : null;
        const user = person ? await ctx.context.internalAdapter.findUserById(person.userId) : null;
        if (!user) throw ctx.redirect(origin);
        const session = await ctx.context.internalAdapter.createSession(user.id);
        if (!session) throw ctx.redirect(origin);
        await setSessionCookie(ctx, { session, user });
        throw ctx.redirect(`${origin}/app`);
      }),
      // The embedded frame cannot hold a third-party cookie, so it trades its code for a session
      // token it keeps in memory. The session is the same kind as any other, only shorter.
      partnerEmbedExchange: createAuthEndpoint(
        "/partner/embed",
        { method: "POST" },
        async (ctx) => {
          ctx.setHeader("cache-control", "no-store");
          ctx.setHeader("referrer-policy", "no-referrer");
          const code = typeof ctx.body?.code === "string" ? ctx.body.code : "";
          const person = code.length > 0 && code.length <= 200 ? await options.consume(code) : null;
          const user = person
            ? await ctx.context.internalAdapter.findUserById(person.userId)
            : null;
          const expiresAt = new Date(Date.now() + PARTNER_SESSION_MS);
          const session = user
            ? await ctx.context.internalAdapter.createSession(user.id, false, { expiresAt }, true)
            : null;
          // Every refusal is the same answer, so a code's state is never revealed.
          if (!user || !session) throw new APIError("UNAUTHORIZED", { message: "Invalid code" });
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ expiresAt: expiresAt.toISOString() });
        },
      ),
    },
  };
}
