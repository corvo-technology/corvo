import type { Actor } from "@corvo/contracts";
import type { PrismaClient } from "@corvo/db";
import { describe, expect, it, vi } from "vitest";
import {
  cancelWhatsAppLink,
  disconnectWhatsAppNumber,
  listWhatsAppNumbers,
  startWhatsAppLink,
  updateWhatsAppNumber,
  whatsAppLinkStatus,
} from "./whatsapp-numbers.js";

const actor = { spaceId: "space-1", userId: "user-1" } as Actor;

const row = (over: Record<string, unknown> = {}) => ({
  id: "inst-1",
  provider: "whatsapp-web",
  workspaceName: "+•••••••0100",
  spaceId: "space-1",
  userId: "user-1",
  botId: "bot-1",
  status: "active",
  pausedAt: null,
  visitorConnectors: [] as string[],
  bot: { name: "Support" },
  ...over,
});

function setup(
  options: {
    surface?: boolean;
    installation?: ReturnType<typeof row> | null;
    connections?: string[];
    ownsBot?: boolean;
  } = {},
) {
  const installationUpdate = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    ...(options.installation ?? row()),
    ...data,
    bot: { name: "Support" },
  }));
  const prisma = {
    bot: {
      findFirst: vi.fn(async () =>
        options.ownsBot === false ? null : { id: "bot-1", spaceId: "space-1" },
      ),
    },
    messagingInstallation: {
      findMany: vi.fn(async () =>
        options.installation === null ? [] : [options.installation ?? row()],
      ),
      findFirst: vi.fn(async () =>
        options.installation === undefined ? row() : options.installation,
      ),
      update: installationUpdate,
    },
    connection: {
      findMany: vi.fn(async () =>
        (options.connections ?? ["linear", "notion"]).map((provider) => ({ provider })),
      ),
    },
  } as unknown as PrismaClient;
  const whatsapp =
    options.surface === false
      ? undefined
      : {
          startLink: vi.fn(async () => ({ linkId: "link-1" })),
          linkStatus: vi.fn(() => ({ state: "qr" as const, qr: "qr-string" })),
          cancelLink: vi.fn(),
          pause: vi.fn(async () => undefined),
          resume: vi.fn(async () => undefined),
          disconnect: vi.fn(async () => undefined),
        };
  return { deps: { prisma, whatsapp }, prisma, whatsapp, installationUpdate };
}

describe("WhatsApp numbers: availability", () => {
  it("is unavailable, with a clear error, where the transport is off", async () => {
    const { deps } = setup({ surface: false });
    expect(await listWhatsAppNumbers(deps, actor)).toEqual({ available: false, numbers: [] });
    await expect(startWhatsAppLink(deps, actor, { botId: "bot-1" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(whatsAppLinkStatus(deps, actor, "link-1")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(disconnectWhatsAppNumber(deps, actor, "inst-1")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("WhatsApp numbers: linking", () => {
  it("links only to an agent the caller owns in their space", async () => {
    const owned = setup();
    expect(await startWhatsAppLink(owned.deps, actor, { botId: "bot-1" })).toEqual({
      linkId: "link-1",
    });
    expect(owned.whatsapp?.startLink).toHaveBeenCalledWith({
      spaceId: "space-1",
      userId: "user-1",
      botId: "bot-1",
    });
    expect(owned.prisma.bot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "bot-1",
          userId: "user-1",
          spaceId: "space-1",
          archivedAt: null,
        }),
      }),
    );
    const foreign = setup({ ownsBot: false });
    await expect(startWhatsAppLink(foreign.deps, actor, { botId: "bot-9" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(foreign.whatsapp?.startLink).not.toHaveBeenCalled();
  });

  it("reads the link status for the caller only", async () => {
    const { deps, whatsapp } = setup();
    expect(await whatsAppLinkStatus(deps, actor, "link-1")).toEqual({
      state: "qr",
      qr: "qr-string",
    });
    expect(whatsapp?.linkStatus).toHaveBeenCalledWith("link-1", "user-1");
  });
});

describe("WhatsApp numbers: list", () => {
  it("lists the caller's own numbers, masked, with their agent and visitor apps", async () => {
    const { deps, prisma } = setup({
      installation: row({ visitorConnectors: ["linear"], pausedAt: new Date() }),
    });
    const result = await listWhatsAppNumbers(deps, actor);
    expect(result).toEqual({
      available: true,
      numbers: [
        {
          id: "inst-1",
          number: "+•••••••0100",
          botId: "bot-1",
          botName: "Support",
          status: "active",
          paused: true,
          visitorConnectors: ["linear"],
        },
      ],
    });
    expect(prisma.messagingInstallation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: "whatsapp-web", spaceId: "space-1", userId: "user-1" },
      }),
    );
  });
});

describe("WhatsApp numbers: update", () => {
  it("changes only the caller's own number", async () => {
    const { deps, whatsapp } = setup({ installation: null });
    await expect(
      updateWhatsAppNumber(deps, actor, { id: "inst-1", paused: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(whatsapp?.pause).not.toHaveBeenCalled();
  });

  it("moves a number to another of the caller's agents, and refuses one that is not theirs", async () => {
    const mine = setup();
    const result = await updateWhatsAppNumber(mine.deps, actor, { id: "inst-1", botId: "bot-2" });
    expect(mine.installationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { botId: "bot-2" } }),
    );
    expect(result.botId).toBe("bot-2");
    const foreign = setup({ ownsBot: false });
    await expect(
      updateWhatsAppNumber(foreign.deps, actor, { id: "inst-1", botId: "bot-9" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(foreign.installationUpdate).not.toHaveBeenCalled();
  });

  it("accepts visitor apps only from the caller's connected apps, without duplicates", async () => {
    const ok = setup();
    await updateWhatsAppNumber(ok.deps, actor, {
      id: "inst-1",
      visitorConnectors: ["notion", "linear", "linear"],
    });
    expect(ok.installationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { visitorConnectors: ["linear", "notion"] } }),
    );
    const bad = setup();
    await expect(
      updateWhatsAppNumber(bad.deps, actor, { id: "inst-1", visitorConnectors: ["gmail"] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(bad.installationUpdate).not.toHaveBeenCalled();
  });

  it("pauses and resumes through the surface", async () => {
    const { deps, whatsapp } = setup();
    await updateWhatsAppNumber(deps, actor, { id: "inst-1", paused: true });
    await updateWhatsAppNumber(deps, actor, { id: "inst-1", paused: false });
    expect(whatsapp?.pause).toHaveBeenCalledWith("inst-1");
    expect(whatsapp?.resume).toHaveBeenCalledWith("inst-1");
  });
});

describe("WhatsApp numbers: disconnect", () => {
  it("disconnects the caller's own number only", async () => {
    const mine = setup();
    expect(await disconnectWhatsAppNumber(mine.deps, actor, "inst-1")).toEqual({ ok: true });
    expect(mine.whatsapp?.disconnect).toHaveBeenCalledWith("inst-1");
    expect(mine.prisma.messagingInstallation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inst-1", provider: "whatsapp-web", spaceId: "space-1", userId: "user-1" },
      }),
    );
    const foreign = setup({ installation: null });
    await expect(disconnectWhatsAppNumber(foreign.deps, actor, "inst-1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(foreign.whatsapp?.disconnect).not.toHaveBeenCalled();
  });
});

describe("WhatsApp numbers: cancelling a link", () => {
  it("stops the person's own link, and is unavailable where the transport is off", async () => {
    const { deps, whatsapp } = setup();
    expect(await cancelWhatsAppLink(deps, actor, "link-1")).toEqual({ ok: true });
    expect(whatsapp?.cancelLink).toHaveBeenCalledWith("link-1", "user-1");
    const off = setup({ surface: false });
    await expect(cancelWhatsAppLink(off.deps, actor, "link-1")).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
