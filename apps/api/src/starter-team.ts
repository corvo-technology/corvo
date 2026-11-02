import type { Actor, AgentCatalogLocale, Bot } from "@corvo/contracts";
import type { MessagingProvisionOptions, PrismaClient } from "@corvo/db";
import { ensureStarterTeam } from "@corvo/db";
import { getLogger } from "@corvo/logging";
import type { RouterDeps } from "./router.js";
import { enqueueBotIntroRun } from "./routes/bots.js";

/**
 * Give an account its Chief and starting team, then have the Chief greet the person once, in
 * their language. A second call finds the Chief already there and starts nothing.
 */
export async function startStarterTeam(
  deps: Pick<RouterDeps, "prisma" | "jobs" | "env">,
  actor: Actor,
  locale: AgentCatalogLocale,
  steps: {
    ensure?: (
      prisma: PrismaClient,
      actor: Actor,
      locale: AgentCatalogLocale,
    ) => Promise<{ botId: string; created: boolean; bot?: Bot }>;
    greet?: typeof enqueueBotIntroRun;
  } = {},
): Promise<{ botId: string; created: boolean }> {
  const ensure = steps.ensure ?? ensureStarterTeam;
  const { botId, created, bot } = await ensure(deps.prisma, actor, locale);
  if (created && bot) {
    const greet = steps.greet ?? enqueueBotIntroRun;
    try {
      await greet(deps as RouterDeps, actor, bot);
    } catch (error) {
      // The Chief exists either way; the person can still talk to it.
      getLogger().error("chief intro run enqueue", error);
    }
  }
  return { botId, created };
}

/**
 * What a first message from a chat app starts: the Chief, written for that app, and its team. It
 * greets by answering the message that just arrived, so there is no greeting run to start. The
 * app's language is not sent with the message, so the Chief is made in English and follows the
 * language the person writes in.
 */
export function chiefAsFirstAgent(
  prisma: PrismaClient,
  ensure: typeof ensureStarterTeam = ensureStarterTeam,
): NonNullable<MessagingProvisionOptions["firstAgent"]> {
  return async ({ actor, provider }) => {
    const { botId } = await ensure(prisma, actor, "en", undefined, { channel: provider });
    return { botId };
  };
}
