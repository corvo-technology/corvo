import type { WhatsAppLinkSurface } from "@corvo/adapters";
import type { Actor, WhatsAppLinkStatus, WhatsAppNumber } from "@corvo/contracts";
import type { PrismaClient } from "@corvo/db";
import { runAsSystem } from "@corvo/db";
import { ORPCError } from "@orpc/server";

const PROVIDER = "whatsapp-web";

export interface WhatsAppNumbersDeps {
  prisma: PrismaClient;
  /** Absent where linked WhatsApp numbers are not enabled. */
  whatsapp?: Pick<
    WhatsAppLinkSurface,
    "startLink" | "linkStatus" | "pause" | "resume" | "disconnect"
  >;
}

function surface(deps: WhatsAppNumbersDeps) {
  if (!deps.whatsapp)
    throw new ORPCError("BAD_REQUEST", { message: "WhatsApp is not available here." });
  return deps.whatsapp;
}

type Row = {
  id: string;
  workspaceName: string;
  botId: string;
  status: string;
  pausedAt: Date | null;
  visitorConnectors: string[];
  bot?: { name: string } | null;
};

const dto = (row: Row): WhatsAppNumber => ({
  id: row.id,
  number: row.workspaceName,
  botId: row.botId,
  ...(row.bot ? { botName: row.bot.name } : {}),
  status: row.status === "disconnected" ? "disconnected" : "active",
  paused: row.pausedAt !== null,
  visitorConnectors: row.visitorConnectors,
});

/** The caller's own number, or NOT_FOUND: another person's number is never confirmed to exist. */
async function ownNumber(deps: WhatsAppNumbersDeps, actor: Actor, id: string) {
  const found = await runAsSystem("find a linked whatsapp number", () =>
    deps.prisma.messagingInstallation.findFirst({
      where: { id, provider: PROVIDER, spaceId: actor.spaceId, userId: actor.userId },
      include: { bot: { select: { name: true } } },
    }),
  );
  if (!found) throw new ORPCError("NOT_FOUND");
  return found;
}

async function ownBot(deps: WhatsAppNumbersDeps, actor: Actor, botId: string) {
  const bot = await runAsSystem("find an agent for a whatsapp number", () =>
    deps.prisma.bot.findFirst({
      where: { id: botId, userId: actor.userId, spaceId: actor.spaceId, archivedAt: null },
      select: { id: true, spaceId: true },
    }),
  );
  if (!bot) throw new ORPCError("NOT_FOUND");
  return bot;
}

export async function startWhatsAppLink(
  deps: WhatsAppNumbersDeps,
  actor: Actor,
  input: { botId: string },
): Promise<{ linkId: string }> {
  const whatsapp = surface(deps);
  const bot = await ownBot(deps, actor, input.botId);
  return whatsapp.startLink({ spaceId: bot.spaceId, userId: actor.userId, botId: bot.id });
}

export async function whatsAppLinkStatus(
  deps: WhatsAppNumbersDeps,
  actor: Actor,
  linkId: string,
): Promise<WhatsAppLinkStatus> {
  return surface(deps).linkStatus(linkId, actor.userId);
}

export async function listWhatsAppNumbers(
  deps: WhatsAppNumbersDeps,
  actor: Actor,
): Promise<{ available: boolean; numbers: WhatsAppNumber[] }> {
  if (!deps.whatsapp) return { available: false, numbers: [] };
  const rows = await runAsSystem("list linked whatsapp numbers", () =>
    deps.prisma.messagingInstallation.findMany({
      where: { provider: PROVIDER, spaceId: actor.spaceId, userId: actor.userId },
      include: { bot: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  );
  return { available: true, numbers: rows.map(dto) };
}

export async function updateWhatsAppNumber(
  deps: WhatsAppNumbersDeps,
  actor: Actor,
  input: { id: string; botId?: string; visitorConnectors?: string[]; paused?: boolean },
): Promise<WhatsAppNumber> {
  const whatsapp = surface(deps);
  const current = await ownNumber(deps, actor, input.id);
  const data: { botId?: string; visitorConnectors?: string[] } = {};
  if (input.botId !== undefined) {
    await ownBot(deps, actor, input.botId);
    data.botId = input.botId;
  }
  if (input.visitorConnectors !== undefined) {
    // A visitor's agent may use only apps the owner has connected, never an arbitrary name.
    const connected = await runAsSystem("list connected apps for a whatsapp number", () =>
      deps.prisma.connection.findMany({
        where: { spaceId: actor.spaceId, userId: actor.userId },
        select: { provider: true },
      }),
    );
    const allowed = new Set(connected.map((connection) => connection.provider));
    const wanted = [...new Set(input.visitorConnectors)].sort();
    if (wanted.some((provider) => !allowed.has(provider))) {
      throw new ORPCError("BAD_REQUEST", { message: "Pick apps you have connected." });
    }
    data.visitorConnectors = wanted;
  }
  let row = current;
  if (Object.keys(data).length > 0) {
    row = await runAsSystem("update a linked whatsapp number", () =>
      deps.prisma.messagingInstallation.update({
        where: { id: current.id },
        data,
        include: { bot: { select: { name: true } } },
      }),
    );
  }
  if (input.paused === true) await whatsapp.pause(current.id);
  if (input.paused === false) await whatsapp.resume(current.id);
  return dto({
    ...row,
    pausedAt: input.paused === undefined ? row.pausedAt : input.paused ? new Date() : null,
  });
}

export async function disconnectWhatsAppNumber(
  deps: WhatsAppNumbersDeps,
  actor: Actor,
  id: string,
): Promise<{ ok: true }> {
  const whatsapp = surface(deps);
  const current = await ownNumber(deps, actor, id);
  await whatsapp.disconnect(current.id);
  return { ok: true as const };
}
