import type { MessagingInboundMessage } from "@corvo/adapter-kit";
import type { PrismaClient } from "@corvo/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WhatsAppIncoming } from "./client.js";
import { WhatsAppLinkSurface } from "./link-surface.js";
import { createPacer, type Pacer } from "./pacing.js";
import { MemoryWhatsAppAuthStore, ScriptedWhatsAppClient } from "./scripted-client.js";

type Row = {
  id: string;
  provider: string;
  workspaceId: string;
  workspaceName: string;
  spaceId: string;
  userId: string;
  botId: string;
  ciphertext: string;
  status: string;
  pausedAt: Date | null;
  resumedAt: Date | null;
  visitorConnectors: string[];
  createdAt: Date;
};

const NOW = new Date("2026-01-01T12:00:00Z");

function setup(
  options: { lock?: () => Promise<(() => Promise<void>) | undefined>; pacer?: Pacer } = {},
) {
  const rows: Row[] = [];
  const stores = new Map<string, MemoryWhatsAppAuthStore>();
  const clients: Array<{ client: ScriptedWhatsAppClient; auth: MemoryWhatsAppAuthStore }> = [];
  const released = vi.fn();
  const prisma = {
    messagingInstallation: {
      create: async ({ data }: { data: Partial<Row> & { id: string } }) => {
        const row = {
          status: "active",
          pausedAt: null,
          resumedAt: null,
          visitorConnectors: [],
          createdAt: new Date(NOW.getTime() - 3_600_000),
          ...data,
        } as Row;
        rows.push(row);
        return row;
      },
      findUnique: async ({
        where,
      }: {
        where: { id?: string; provider_workspaceId?: { provider: string; workspaceId: string } };
      }) =>
        rows.find((row) =>
          where.id
            ? row.id === where.id
            : row.provider === where.provider_workspaceId?.provider &&
              row.workspaceId === where.provider_workspaceId?.workspaceId,
        ) ?? null,
      findMany: async ({ where }: { where: { provider: string; status?: string } }) =>
        rows.filter(
          (row) =>
            row.provider === where.provider && (where.status ? row.status === where.status : true),
        ),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((r) => r.id === where.id) as Row;
        Object.assign(row, data);
        return row;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const index = rows.findIndex((row) => row.id === where.id);
        if (index >= 0) rows.splice(index, 1);
      },
    },
  } as unknown as PrismaClient;
  const surface = new WhatsAppLinkSurface({
    prisma,
    createClient: (auth) => {
      const client = new ScriptedWhatsAppClient(auth);
      clients.push({ client, auth: auth as MemoryWhatsAppAuthStore });
      return client;
    },
    authStoreFor: (installation) => {
      let store = stores.get(installation.id);
      if (!store) {
        store = new MemoryWhatsAppAuthStore();
        stores.set(installation.id, store);
      }
      return store;
    },
    acquireLock: options.lock ?? (async () => released),
    now: () => NOW,
    newId: (() => {
      let n = 0;
      return () => `id${++n}`;
    })(),
    retryMs: 30_000,
    pacer: options.pacer ?? { beforeSend: async () => undefined, allowIncoming: () => true },
  });
  const inbound: MessagingInboundMessage[] = [];
  surface.onInbound(async (event) => {
    if (event.type === "message") inbound.push(event);
  });
  return { surface, rows, clients, stores, inbound, released };
}

const message = (over: Partial<WhatsAppIncoming> = {}): WhatsAppIncoming => ({
  chat: { id: "15550200@s.whatsapp.net", kind: "direct" },
  messageId: "m1",
  senderId: "15550200@s.whatsapp.net",
  senderName: "Ana",
  fromMe: false,
  text: "hello",
  sentAt: new Date(NOW.getTime() - 5_000),
  history: false,
  ...over,
});

/** Links a number: the QR, then the scan. Returns the persistent client's index. */
async function link(ctx: ReturnType<typeof setup>) {
  const { linkId } = await ctx.surface.startLink({
    spaceId: "space-1",
    userId: "user-1",
    botId: "bot-1",
  });
  const temporary = ctx.clients[0]?.client as ScriptedWhatsAppClient;
  temporary.emitConnection({ state: "qr", qr: "qr-1" });
  const qr = ctx.surface.linkStatus(linkId, "user-1");
  await ctx.clients[0]?.auth.set("creds", "session-secret");
  temporary.emitConnection({ state: "open", number: "+15550100" });
  await vi.waitFor(() => expect(ctx.clients.length).toBe(2));
  return { linkId, qr, persistent: ctx.clients[1]?.client as ScriptedWhatsAppClient };
}

beforeEach(() =>
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }),
);
afterEach(() => vi.useRealTimers());

describe("WhatsAppLinkSurface linking", () => {
  it("shows the QR, then creates the installation with the chosen agent and keeps the session", async () => {
    const ctx = setup();
    const { linkId, qr, persistent } = await link(ctx);
    expect(qr).toEqual({ state: "qr", qr: "qr-1" });
    expect(ctx.surface.linkStatus(linkId, "user-1")).toEqual({
      state: "linked",
      number: "+•••••••0100",
    });
    expect(ctx.rows).toHaveLength(1);
    expect(ctx.rows[0]).toMatchObject({
      provider: "whatsapp-web",
      workspaceId: "15550100",
      botId: "bot-1",
      spaceId: "space-1",
      userId: "user-1",
      status: "active",
    });
    // The session moved from the temporary memory to the number's own store, and the temporary client stopped.
    expect(await ctx.stores.get(ctx.rows[0]?.id ?? "")?.get("creds")).toBe("session-secret");
    expect(ctx.clients[0]?.client.connected).toBe(false);
    expect(persistent.connected).toBe(true);
  });

  it("shows the QR only to the person who started the link", async () => {
    const ctx = setup();
    const { linkId, qr } = await link(ctx);
    expect(qr).toEqual({ state: "qr", qr: "qr-1" });
    expect(ctx.surface.linkStatus(linkId, "someone-else")).toEqual({ state: "failed" });
  });

  it("refuses a number already linked to someone else", async () => {
    const ctx = setup();
    await link(ctx);
    (ctx.rows[0] as Row).userId = "someone-else";
    const { linkId } = await ctx.surface.startLink({
      spaceId: "space-1",
      userId: "user-1",
      botId: "bot-1",
    });
    const second = ctx.clients[2]?.client as ScriptedWhatsAppClient;
    second.emitConnection({ state: "open", number: "+15550100" });
    await vi.waitFor(() => expect(ctx.surface.linkStatus(linkId, "user-1").state).toBe("failed"));
    expect(ctx.rows).toHaveLength(1);
  });
});

describe("WhatsAppLinkSurface messages", () => {
  it("sends the owner's self-chat and visitors to the sink with their audience", async () => {
    const ctx = setup();
    const { persistent } = await link(ctx);
    persistent.emitMessage(message({ messageId: "v1" }));
    persistent.emitMessage(
      message({
        messageId: "o1",
        chat: { id: "15550100@s.whatsapp.net", kind: "self" },
        fromMe: true,
      }),
    );
    await vi.waitFor(() => expect(ctx.inbound).toHaveLength(2));
    expect(ctx.inbound.map((e) => [e.handle, e.audience])).toEqual([
      ["v1", "visitor"],
      ["o1", "owner"],
    ]);
    expect(ctx.inbound[0]).toMatchObject({
      provider: "whatsapp-web",
      isDirect: true,
      content: "hello",
      from: "15550200@s.whatsapp.net",
      fromLabel: "Ana",
      installationBotId: "bot-1",
      installationSpaceId: "space-1",
    });
    expect(ctx.inbound[0]?.threadId).toBe(
      `whatsapp-web:${ctx.rows[0]?.id}:15550200@s.whatsapp.net`,
    );
  });

  it("records history and ignores groups and the owner's messages in other chats", async () => {
    const ctx = setup();
    const { persistent } = await link(ctx);
    persistent.emitMessage(message({ messageId: "old", history: true }));
    persistent.emitMessage(message({ messageId: "grp", chat: { id: "g@g.us", kind: "group" } }));
    persistent.emitMessage(message({ messageId: "mine", fromMe: true }));
    persistent.emitMessage(message({ messageId: "live" }));
    await vi.waitFor(() => expect(ctx.inbound.length).toBeGreaterThanOrEqual(2));
    expect(ctx.inbound.map((e) => [e.handle, e.audience])).toEqual([
      ["old", "record"],
      ["live", "visitor"],
    ]);
  });

  it("records everything while paused, and answers again only to what arrives after resume", async () => {
    const ctx = setup();
    const { persistent } = await link(ctx);
    const id = ctx.rows[0]?.id ?? "";
    await ctx.surface.pause(id);
    expect(ctx.rows[0]?.pausedAt).toEqual(NOW);
    persistent.emitMessage(message({ messageId: "while-paused" }));
    await vi.waitFor(() => expect(ctx.inbound).toHaveLength(1));
    expect(ctx.inbound[0]?.audience).toBe("record");
    await ctx.surface.resume(id);
    expect(ctx.rows[0]).toMatchObject({ pausedAt: null, resumedAt: NOW });
    persistent.emitMessage(
      message({ messageId: "before-resume", sentAt: new Date(NOW.getTime() - 60_000) }),
    );
    persistent.emitMessage(
      message({ messageId: "after-resume", sentAt: new Date(NOW.getTime() + 1) }),
    );
    await vi.waitFor(() => expect(ctx.inbound).toHaveLength(3));
    expect(ctx.inbound.slice(1).map((e) => [e.handle, e.audience])).toEqual([
      ["before-resume", "record"],
      ["after-resume", "visitor"],
    ]);
  });

  it("shows typing before a reply and clears it, all before the text is sent", async () => {
    const log: string[] = [];
    const pacer = createPacer({
      now: () => 0,
      sleep: async () => void log.push("wait"),
      random: () => 0,
    });
    const ctx = setup({ pacer });
    const { persistent } = await link(ctx);
    const send = persistent.sendText.bind(persistent);
    const typing = persistent.setTyping.bind(persistent);
    persistent.sendText = async (chat, text) => (log.push("send"), send(chat, text));
    persistent.setTyping = async (chat, on) => (
      log.push(on ? "typing-on" : "typing-off"), typing(chat, on)
    );
    await ctx.surface.sendToThread(
      { threadId: `whatsapp-web:${ctx.rows[0]?.id}:15550200@s.whatsapp.net`, body: "hello" },
      {} as never,
    );
    expect(log).toEqual(["typing-on", "wait", "typing-off", "send"]);
  });

  it("answers the incoming limit from its pacer", async () => {
    const ctx = setup({
      pacer: { beforeSend: async () => undefined, allowIncoming: (_n, sender) => sender === "ana" },
    });
    expect(ctx.surface.allowIncoming("n1", "ana")).toBe(true);
    expect(ctx.surface.allowIncoming("n1", "bruno")).toBe(false);
  });

  it("sends a reply to the right number's chat, and marks a message read", async () => {
    const ctx = setup();
    const { persistent } = await link(ctx);
    const thread = `whatsapp-web:${ctx.rows[0]?.id}:15550200@s.whatsapp.net`;
    const result = await ctx.surface.sendToThread({ threadId: thread, body: "hi" }, {} as never);
    await ctx.surface.acknowledge(thread, "m1", {} as never);
    expect(persistent.sent).toEqual([{ chatId: "15550200@s.whatsapp.net", text: "hi" }]);
    expect(result.handle).toBeTruthy();
    expect(persistent.read).toEqual([{ chatId: "15550200@s.whatsapp.net", messageId: "m1" }]);
    await expect(
      ctx.surface.sendToThread(
        { threadId: "whatsapp-web:unknown:x@s.whatsapp.net", body: "hi" },
        {} as never,
      ),
    ).rejects.toThrow();
  });
});

describe("WhatsAppLinkSurface lifecycle", () => {
  it("marks the number disconnected when WhatsApp logs it out, and does not connect it again", async () => {
    const ctx = setup();
    const { persistent } = await link(ctx);
    persistent.emitConnection({ state: "closed", reason: "logged-out" });
    await vi.waitFor(() => expect(ctx.rows[0]?.status).toBe("disconnected"));
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(ctx.clients).toHaveLength(2);
    expect(ctx.released).toHaveBeenCalled();
  });

  it("disconnecting logs the device out, deletes the number and releases the lock", async () => {
    const ctx = setup();
    const { persistent } = await link(ctx);
    const id = ctx.rows[0]?.id ?? "";
    await ctx.surface.disconnect(id);
    expect(ctx.rows).toHaveLength(0);
    expect(persistent.connected).toBe(false);
    expect(await ctx.stores.get(id)?.get("creds")).toBeUndefined();
    expect(ctx.released).toHaveBeenCalled();
  });

  it("starts every active number on initialize, and none that was logged out", async () => {
    const linked = setup();
    await link(linked);
    const active = linked.rows[0] as Row;
    const first = setup();
    first.rows.push(
      { ...active, id: "alive" },
      { ...active, id: "gone", workspaceId: "15550999", status: "disconnected" },
    );
    await first.surface.initialize();
    expect(first.clients).toHaveLength(1);
    expect(first.clients[0]?.client.connected).toBe(true);
    await first.surface.shutdown();
    expect(first.clients[0]?.client.connected).toBe(false);
  });

  it("does not connect a number another process holds, and takes it once the lock frees", async () => {
    let held = true;
    const ctx = setup({ lock: async () => (held ? undefined : async () => undefined) });
    ctx.rows.push({
      id: "inst-1",
      provider: "whatsapp-web",
      workspaceId: "15550100",
      workspaceName: "+•••••••0100",
      spaceId: "space-1",
      userId: "user-1",
      botId: "bot-1",
      ciphertext: "",
      status: "active",
      pausedAt: null,
      resumedAt: null,
      visitorConnectors: [],
      createdAt: new Date(NOW.getTime() - 3_600_000),
    });
    await ctx.surface.initialize();
    expect(ctx.clients).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(ctx.clients).toHaveLength(0);
    held = false;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(ctx.clients).toHaveLength(1);
    await ctx.surface.shutdown();
  });
});
