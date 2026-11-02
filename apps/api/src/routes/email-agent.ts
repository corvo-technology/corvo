import { ORPCError } from "@orpc/server";
import { findEmailAgent, installEmailAgent } from "../email-agent.js";
import type { RouterContext } from "./context.js";

export function emailAgentRoutes(ctx: RouterContext) {
  const { deps, authed, repos } = ctx;
  return {
    emailAgent: {
      status: authed.emailAgent.status.handler(async ({ context }) => ({
        available: Boolean(deps.emailAgentPublicUrl),
        agent: await findEmailAgent(deps.prisma, context.actor),
      })),
      install: authed.emailAgent.install.handler(async ({ context, input }) => {
        if (!deps.emailAgentPublicUrl) throw new ORPCError("BAD_REQUEST");
        try {
          return await installEmailAgent(
            {
              prisma: deps.prisma,
              secrets: deps.secrets,
              publicUrl: deps.emailAgentPublicUrl,
              createBot: (actor, bot) => repos.createBot(actor, bot),
            },
            context.actor,
            input.serverId,
            input.locale,
          );
        } catch (error) {
          if (error instanceof Error && error.message === "Unknown inbox service")
            throw new ORPCError("BAD_REQUEST");
          throw error;
        }
      }),
    },
  };
}
