import type { Actor } from "@corvo/contracts";
import { describe, expect, it, vi } from "vitest";
import type { RouterContext } from "./context.js";
import { emailAgentRoutes } from "./email-agent.js";

const actor: Actor = {
  spaceId: "space-a",
  userId: "user-a",
  email: "fake@example.test",
  isDeploymentOwner: false,
};

type Handler = (args: { context: { actor: Actor }; input: never }) => Promise<unknown>;

function routes(publicUrl: string | undefined, prisma: Record<string, unknown> = {}) {
  const identity = (fn: Handler) => fn;
  const built = emailAgentRoutes({
    deps: { emailAgentPublicUrl: publicUrl, prisma, secrets: {} },
    authed: { emailAgent: { status: { handler: identity }, install: { handler: identity } } },
    repos: { createBot: vi.fn() },
  } as unknown as RouterContext) as unknown as Record<
    "emailAgent",
    Record<"status" | "install", Handler>
  >;
  return (name: "status" | "install", input: unknown = {}) =>
    built.emailAgent[name]({ context: { actor }, input: input as never });
}

describe("email agent routes", () => {
  it("is unavailable, with no agent, where the deployment has no public address", async () => {
    const prisma = { bot: { findFirst: vi.fn(async () => null) } };
    expect(await routes(undefined, prisma)("status")).toEqual({ available: false, agent: null });
  });

  it("reports the user's email agent when there is one", async () => {
    const prisma = {
      bot: { findFirst: vi.fn(async () => ({ id: "bot-1", name: "Email agent" })) },
    };
    expect(await routes("https://corvo.example.test", prisma)("status")).toEqual({
      available: true,
      agent: { botId: "bot-1", botName: "Email agent" },
    });
  });

  it("does not refuse to install where the deployment has no public address", async () => {
    const findFirst = vi.fn(async () => null);
    await expect(
      routes(undefined, { mcpServer: { findFirst } })("install", { serverId: "srv-1" }),
    ).rejects.toThrow();
    // It got as far as looking the inbox service up, instead of stopping at the address.
    expect(findFirst).toHaveBeenCalled();
  });

  it("refuses a server that is not an inbox service", async () => {
    const prisma = { mcpServer: { findFirst: vi.fn(async () => null) } };
    await expect(
      routes("https://corvo.example.test", prisma)("install", { serverId: "srv-1" }),
    ).rejects.toThrow();
  });
});
