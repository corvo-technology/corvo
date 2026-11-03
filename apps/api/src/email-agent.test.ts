import type { SecretStore } from "@corvo/adapter-kit";
import type { Actor } from "@corvo/contracts";
import type { PrismaClient } from "@corvo/db";
import { describe, expect, it, vi } from "vitest";
import { findEmailAgent, installEmailAgent } from "./email-agent.js";
import { emailWakeToken } from "./email-webhook.js";

const actor: Actor = {
  spaceId: "space-a",
  userId: "user-a",
  email: "fake@example.test",
  isDeploymentOwner: false,
};

function fixture(
  server: Record<string, unknown> | null = {
    id: "srv-1",
    slug: "millionsend",
    name: "MillionSend",
  },
) {
  const stored: Array<{ id: string; kind: string; plaintext: string }> = [];
  const bot = { id: "bot-1", webhookSecretId: null as string | null, instructions: "" };
  const prisma = {
    mcpServer: { findFirst: vi.fn(async () => server) },
    bot: {
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) =>
        Object.assign(bot, data),
      ),
      findFirst: vi.fn(async () => ({ id: "bot-1", name: "Email agent" })),
    },
    secret: {
      create: vi.fn(
        async ({ data }: { data: { id: string; kind: string; ciphertext: string } }) => {
          stored.push({
            id: data.id,
            kind: data.kind,
            plaintext: data.ciphertext.replace("sealed:", ""),
          });
        },
      ),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    botMcpServer: { upsert: vi.fn(async () => ({})) },
    $transaction: async (fn: (tx: unknown) => unknown) => fn(prisma),
  } as unknown as PrismaClient;
  const secrets = {
    put: vi.fn(async (plaintext: string) => ({ id: "sec-1", ciphertext: `sealed:${plaintext}` })),
  } as unknown as SecretStore;
  const createBot = vi.fn(async () => ({ ...bot, webhookSecretId: bot.webhookSecretId }));
  return { prisma, secrets, createBot, stored, bot };
}

const install = (f: ReturnType<typeof fixture>) =>
  installEmailAgent(
    {
      prisma: f.prisma,
      secrets: f.secrets,
      publicUrl: "https://corvo.example.test",
      createBot: f.createBot,
    },
    actor,
    "srv-1",
  );

describe("installEmailAgent", () => {
  it("creates one email agent per user, so installing twice reuses it", async () => {
    const f = fixture();
    await install(f);
    expect(f.createBot).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ name: "Email agent", spawnKey: "email-agent:user-a" }),
    );
  });

  it("gives the bot access to the inbox service's server", async () => {
    const f = fixture();
    await install(f);
    expect(f.prisma.botMcpServer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { botId_serverId: { botId: "bot-1", serverId: "srv-1" } },
      }),
    );
  });

  it("tells the bot the address the service should call, built from the bot's own webhook secret", async () => {
    const f = fixture();
    await install(f);
    const secret = f.stored.find((s) => s.kind === "webhook")!.plaintext;
    const token = emailWakeToken(secret);
    expect(f.bot.instructions).toContain(
      `https://corvo.example.test/api/v1/bots/bot-1/email/${token}`,
    );
    expect(f.bot.instructions).not.toContain(secret);
  });

  it("writes the bot's name and instructions in Portuguese for a Portuguese app", async () => {
    const f = fixture();
    await installEmailAgent(
      {
        prisma: f.prisma,
        secrets: f.secrets,
        publicUrl: "https://corvo.example.test",
        createBot: f.createBot,
      },
      actor,
      "srv-1",
      "pt-BR",
    );
    expect(f.createBot).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ name: "Agente de email" }),
    );
    expect(f.bot.instructions).toContain("Você cuida do email do seu dono");
    expect(f.bot.instructions).toContain("/api/v1/bots/bot-1/email/");
  });

  it("writes them in English otherwise", async () => {
    const f = fixture();
    await install(f);
    expect(f.createBot).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ name: "Email agent" }),
    );
    expect(f.bot.instructions).toContain("You handle email for your owner");
  });

  describe("on a server with no public address", () => {
    const installLocal = (f: ReturnType<typeof fixture>, locale?: "en" | "pt-BR") =>
      installEmailAgent(
        { prisma: f.prisma, secrets: f.secrets, createBot: f.createBot },
        actor,
        "srv-1",
        locale,
      );

    it("sets no webhook up: no secret is stored and the bot has none", async () => {
      const f = fixture();
      await installLocal(f);
      expect(f.secrets.put).not.toHaveBeenCalled();
      expect(f.prisma.secret.create).not.toHaveBeenCalled();
      expect(f.prisma.bot.update).toHaveBeenCalledWith({
        where: { id: "bot-1" },
        data: { instructions: expect.any(String) },
      });
      expect(f.bot.webhookSecretId).toBeNull();
    });

    it("tells the bot to ask its owner how often to check, then create the routine itself", async () => {
      const f = fixture();
      await installLocal(f);
      expect(f.bot.instructions).toContain("no public address");
      expect(f.bot.instructions).toContain("ask_user");
      expect(f.bot.instructions).toContain("schedule_create");
      expect(f.bot.instructions).not.toContain("/api/v1/bots/");
      expect(f.bot.instructions).not.toContain("inbox.email.received");
    });

    it("says the same in Portuguese, and still gives the bot the inbox service's tools", async () => {
      const f = fixture();
      await installLocal(f, "pt-BR");
      expect(f.bot.instructions).toContain("não tem endereço público");
      expect(f.bot.instructions).toContain("schedule_create");
      expect(f.prisma.botMcpServer.upsert).toHaveBeenCalledOnce();
    });
  });

  it("refuses a server that is not an inbox service the user added", async () => {
    await expect(install(fixture(null))).rejects.toThrow();
    await expect(
      install(fixture({ id: "srv-1", slug: "notion", name: "Notion" })),
    ).rejects.toThrow();
  });
});

describe("findEmailAgent", () => {
  it("finds the user's email agent by its key", async () => {
    const f = fixture();
    expect(await findEmailAgent(f.prisma, actor)).toEqual({
      botId: "bot-1",
      botName: "Email agent",
    });
    expect(f.prisma.bot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ spawnKey: "email-agent:user-a", archivedAt: null }),
      }),
    );
  });
});
