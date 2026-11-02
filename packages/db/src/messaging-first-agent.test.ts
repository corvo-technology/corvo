import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "./client.js";
import { provisionMessagingIdentity } from "./messaging.js";

const env = { signupsEnabled: undefined, signupAllowlist: undefined };

/** An account whose user and space already exist, so only the first agent and the identity are made. */
function fixture(over: { otherBot?: boolean } = {}) {
  const identities: Array<Record<string, unknown>> = [];
  const prisma = {
    messagingIdentity: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        identities.push(data);
        return data;
      }),
    },
    user: {
      findUnique: vi.fn(async () => ({ id: "user-1", email: "msg-x@messaging.invalid" })),
    },
    spaceMember: { findFirst: vi.fn(async () => ({ spaceId: "space-1" })) },
    // A bot that is not the Chief, such as a team member made before a crash.
    bot: {
      findFirst: vi.fn(async () => (over.otherBot ? { id: "team-member" } : null)),
    },
    thread: {
      findFirst: vi.fn(async ({ where }: { where: { botId: string } }) => ({
        id: `thread-of-${where.botId}`,
      })),
    },
  } as unknown as PrismaClient;
  return { prisma, identities };
}

const request = { provider: "telegram", address: "424242" };

describe("provisionMessagingIdentity with a first agent", () => {
  it("uses the agent the deployment makes, for the chat app and sender, as the account's bot", async () => {
    const f = fixture();
    const firstAgent = vi.fn(async () => ({ botId: "chief-1" }));
    const result = await provisionMessagingIdentity(f.prisma, request, env, { firstAgent });
    expect(firstAgent).toHaveBeenCalledWith({
      actor: {
        userId: "user-1",
        spaceId: "space-1",
        email: "msg-x@messaging.invalid",
        isDeploymentOwner: false,
      },
      provider: "telegram",
      address: "424242",
    });
    expect(result).toMatchObject({
      botId: "chief-1",
      threadId: "thread-of-chief-1",
      created: true,
    });
    expect(f.identities[0]).toMatchObject({
      provider: "telegram",
      address: "424242",
      botId: "chief-1",
    });
  });

  it("asks again on a retry even when the account already has some other bot", async () => {
    const f = fixture({ otherBot: true });
    const firstAgent = vi.fn(async () => ({ botId: "chief-1" }));
    const result = await provisionMessagingIdentity(f.prisma, request, env, { firstAgent });
    expect(firstAgent).toHaveBeenCalledTimes(1);
    // Not the team member a crash left behind.
    expect(result.botId).toBe("chief-1");
  });

  it("does not create the account's identity when the first agent cannot be made", async () => {
    const f = fixture();
    const firstAgent = vi.fn(async () => {
      throw new Error("no agent");
    });
    await expect(
      provisionMessagingIdentity(f.prisma, request, env, { firstAgent }),
    ).rejects.toThrow("no agent");
    expect(f.identities).toEqual([]);
  });
});
