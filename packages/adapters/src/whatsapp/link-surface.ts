import { randomBytes } from "node:crypto";
import type {
  AdapterContext,
  MessagingInboundEvent,
  MessagingInboundMessage,
  MessagingSendRequest,
  MessagingSendResult,
  MessagingSurface,
} from "@corvo/adapter-kit";
import type { PrismaClient } from "@corvo/db";
import { runAsSystem } from "@corvo/db";
import { getLogger } from "@corvo/logging";
import { classifyIncoming } from "./classify.js";
import type {
  WhatsAppAuthStore,
  WhatsAppClientFactory,
  WhatsAppConnectionEvent,
  WhatsAppIncoming,
  WhatsAppLinkClient,
} from "./client.js";
import type { AcquireNumberLock } from "./number-lock.js";
import { createPacer, type Pacer } from "./pacing.js";
import { MemoryWhatsAppAuthStore } from "./scripted-client.js";

export const WHATSAPP_LINK_PROVIDER = "whatsapp-web";
/** Every thread this surface owns starts with this, so others can tell where to send. */
export const WHATSAPP_THREAD_PREFIX = `${WHATSAPP_LINK_PROVIDER}:`;
const LINK_TTL_MS = 10 * 60_000;

export interface WhatsAppLinkSurfaceDeps {
  prisma: PrismaClient;
  createClient: WhatsAppClientFactory;
  /** Where a number's session lives once it is linked. */
  authStoreFor(installation: { id: string; spaceId: string; userId: string }): WhatsAppAuthStore;
  acquireLock: AcquireNumberLock;
  now?: () => Date;
  newId?: () => string;
  /** How often a number another process holds is tried again. */
  retryMs?: number;
  /** Paces replies and limits incoming work; a default one is used when absent. */
  pacer?: Pacer;
}

export type LinkStatus =
  | { state: "qr"; qr?: string }
  | { state: "linked"; number: string }
  | { state: "failed" };

type Installation = {
  id: string;
  spaceId: string;
  userId: string;
  botId: string;
  createdAt: Date;
  pausedAt: Date | null;
  resumedAt: Date | null;
  status: string;
};

type Running = { client: WhatsAppLinkClient; release: () => Promise<void> };
type PendingLink = {
  /** Only the person who started a link may read its QR code. */
  userId: string;
  /** Stops the link when nobody finishes it. */
  timer?: ReturnType<typeof setTimeout>;
  status: LinkStatus;
  client: WhatsAppLinkClient;
  memory: MemoryWhatsAppAuthStore;
  expires: number;
};

/** Releasing a lock must never stop a shutdown or a disconnect. */
async function safeRelease(release: () => Promise<void>): Promise<void> {
  try {
    await release();
  } catch (error) {
    getLogger().warn("whatsapp number lock release failed", {
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}

/** "+15550100" shown as "+•••••••0100": the length is not given away. */
export function maskNumber(number: string): string {
  const digits = number.replace(/\D/g, "");
  return `+${"•".repeat(7)}${digits.slice(-4)}`;
}

const extensionFor = (mimeType: string) =>
  mimeType.startsWith("audio/ogg")
    ? "voice-note.ogg"
    : mimeType === "image/jpeg"
      ? "image.jpg"
      : mimeType.startsWith("image/")
        ? `image.${mimeType.slice(6)}`
        : "file";

/**
 * Holds one WhatsApp Web socket per linked number inside this process, and turns what arrives into
 * the same inbound events the other messaging surfaces emit.
 */
export class WhatsAppLinkSurface implements MessagingSurface {
  private sink: ((event: MessagingInboundEvent) => Promise<void>) | undefined;
  private readonly running = new Map<string, Running>();
  private readonly links = new Map<string, PendingLink>();
  private readonly waiting = new Set<string>();
  private retryTimer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;

  private readonly pacer: Pacer;
  /** Ids of messages this surface sent, so they are not taken for the owner writing. */
  private readonly sentIds = new Set<string>();

  constructor(private readonly deps: WhatsAppLinkSurfaceDeps) {
    this.pacer = deps.pacer ?? createPacer();
  }

  /** False once a sender or a number has started too much work: the message is dropped. */
  allowIncoming(installationId: string, senderId: string): boolean {
    return this.pacer.allowIncoming(installationId, senderId);
  }

  private now() {
    return this.deps.now?.() ?? new Date();
  }
  private newId() {
    return this.deps.newId?.() ?? randomBytes(16).toString("hex");
  }

  describe() {
    return {
      id: WHATSAPP_LINK_PROVIDER,
      contractVersion: "1",
      adapterVersion: "1",
      capabilities: { providers: [WHATSAPP_LINK_PROVIDER] },
    };
  }
  platforms() {
    return [
      {
        provider: WHATSAPP_LINK_PROVIDER,
        capabilities: { direct: true, groups: false, receipt: null, files: false },
      },
    ];
  }
  handleWebhook(): null {
    return null;
  }
  onInbound(sink: (event: MessagingInboundEvent) => Promise<void>) {
    this.sink = sink;
  }

  async initialize(): Promise<void> {
    this.stopped = false;
    const rows = await runAsSystem("list linked whatsapp numbers", () =>
      this.deps.prisma.messagingInstallation.findMany({
        where: { provider: WHATSAPP_LINK_PROVIDER, status: "active" },
      }),
    );
    for (const row of rows) await this.activate(row as Installation);
  }

  async shutdown(): Promise<void> {
    this.stopped = true;
    if (this.retryTimer) clearInterval(this.retryTimer);
    this.retryTimer = undefined;
    this.waiting.clear();
    for (const [linkId] of [...this.links]) this.endLink(linkId);
    this.links.clear();
    const all = [...this.running.entries()];
    this.running.clear();
    for (const [, running] of all) {
      await running.client.close().catch(() => undefined);
      await safeRelease(running.release);
    }
  }

  // ---- linking ----

  async startLink(input: {
    spaceId: string;
    userId: string;
    botId: string;
  }): Promise<{ linkId: string }> {
    const now = this.now().getTime();
    // One pending link per person: Add again stops the one before it.
    for (const [id, link] of this.links) {
      if (link.userId === input.userId || link.expires < now) this.endLink(id);
    }
    const linkId = this.newId();
    const memory = new MemoryWhatsAppAuthStore();
    const client = this.deps.createClient(memory);
    const link: PendingLink = {
      userId: input.userId,
      status: { state: "qr" },
      client,
      memory,
      expires: now + LINK_TTL_MS,
    };
    this.links.set(linkId, link);
    link.timer = setTimeout(() => this.endLink(linkId), LINK_TTL_MS);
    client.onConnection((event) => {
      if (event.state === "qr") link.status = { state: "qr", qr: event.qr };
      else if (event.state === "open") void this.finishLink(link, event.number, input);
      // A QR code that times out is the end of the link, not a reason to show new ones forever.
      else this.endLink(linkId, { state: "failed" });
    });
    await client.connect();
    return { linkId };
  }

  /** Stops a link's socket and forgets it, leaving a status behind only when asked. */
  private endLink(linkId: string, status?: LinkStatus) {
    const link = this.links.get(linkId);
    if (!link) return;
    if (link.timer) clearTimeout(link.timer);
    void link.client.close().catch(() => undefined);
    if (status) link.status = status;
    else this.links.delete(linkId);
  }

  /** The person who started a link can stop it before it is scanned. */
  cancelLink(linkId: string, userId: string): void {
    const link = this.links.get(linkId);
    if (link?.userId === userId) this.endLink(linkId);
  }

  linkStatus(linkId: string, userId: string): LinkStatus {
    const link = this.links.get(linkId);
    return link && link.userId === userId ? link.status : { state: "failed" };
  }

  private async finishLink(
    link: PendingLink,
    number: string,
    input: { spaceId: string; userId: string; botId: string },
  ): Promise<void> {
    try {
      const workspaceId = number.replace(/\D/g, "");
      const existing = await runAsSystem("find linked whatsapp number", () =>
        this.deps.prisma.messagingInstallation.findUnique({
          where: { provider_workspaceId: { provider: WHATSAPP_LINK_PROVIDER, workspaceId } },
        }),
      );
      if (existing && (existing.spaceId !== input.spaceId || existing.userId !== input.userId)) {
        link.status = { state: "failed" };
        await link.client.close();
        return;
      }
      const id = existing?.id ?? this.newId();
      const data = {
        botId: input.botId,
        status: "active",
        pausedAt: null,
        resumedAt: null,
      };
      const row = existing
        ? await runAsSystem("relink whatsapp number", () =>
            this.deps.prisma.messagingInstallation.update({ where: { id }, data }),
          )
        : await runAsSystem("link whatsapp number", () =>
            this.deps.prisma.messagingInstallation.create({
              data: {
                id,
                provider: WHATSAPP_LINK_PROVIDER,
                workspaceId,
                workspaceName: maskNumber(number),
                spaceId: input.spaceId,
                userId: input.userId,
                ciphertext: "",
                ...data,
              },
            }),
          );
      // A number linked again starts from its new session alone, and any socket still running
      // on the old one is stopped.
      const running = this.running.get(id);
      if (running) {
        this.running.delete(id);
        await running.client.close().catch(() => undefined);
        await safeRelease(running.release);
      }
      // The session moves from memory to the number's own encrypted store.
      const store = this.deps.authStoreFor({ id, spaceId: input.spaceId, userId: input.userId });
      await store.clear();
      for (const [name, value] of link.memory.entries()) await store.set(name, value);
      await link.client.close();
      link.status = { state: "linked", number: maskNumber(number) };
      await this.activate(row as Installation);
    } catch (error) {
      getLogger().error("whatsapp link failed", error);
      link.status = { state: "failed" };
    }
  }

  // ---- holding sockets ----

  private async activate(row: Installation): Promise<void> {
    if (this.running.has(row.id) || this.stopped) return;
    const release = await this.deps.acquireLock(row.id, () => void this.onLockLost(row.id));
    if (!release) {
      // Another process holds this number; try again later, which also covers it dying.
      this.waiting.add(row.id);
      this.scheduleRetry();
      return;
    }
    this.waiting.delete(row.id);
    const client = this.deps.createClient(this.deps.authStoreFor(row));
    const running: Running = { client, release };
    this.running.set(row.id, running);
    client.onConnection((event) => void this.onConnection(row.id, event));
    client.onMessage((message) => void this.deliver(row.id, message));
    try {
      await client.connect();
    } catch (error) {
      getLogger().error("whatsapp connect failed", error);
    }
  }

  private scheduleRetry() {
    if (this.retryTimer || this.stopped) return;
    this.retryTimer = setInterval(() => void this.retryWaiting(), this.deps.retryMs ?? 30_000);
  }

  private async retryWaiting() {
    for (const id of [...this.waiting]) {
      const row = await runAsSystem("reload linked whatsapp number", () =>
        this.deps.prisma.messagingInstallation.findUnique({ where: { id } }),
      );
      if (row?.status !== "active") this.waiting.delete(id);
      else await this.activate(row as Installation);
    }
    if (this.waiting.size === 0 && this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = undefined;
    }
  }

  /** Stops holding a number without logging it out or marking it, and tries to take it again. */
  private async stopHolding(id: string, options: { release: boolean }) {
    const running = this.running.get(id);
    this.running.delete(id);
    if (running) {
      await running.client.close().catch(() => undefined);
      if (options.release) await safeRelease(running.release);
    }
    if (!this.stopped) {
      this.waiting.add(id);
      this.scheduleRetry();
    }
  }

  /** The lock was lost under a running socket: another process may take the number, so stop. */
  private async onLockLost(id: string) {
    await this.stopHolding(id, { release: false });
  }

  private async onConnection(id: string, event: WhatsAppConnectionEvent) {
    if (event.state !== "closed" || event.reason === "network") return;
    // Another connection took over this one. That is not the end of the session: stop here and
    // try again later, which finds out whether another process of ours holds it.
    if (event.reason === "replaced") {
      await this.stopHolding(id, { release: true });
      return;
    }
    // WhatsApp ended this device's session, so there is nothing to reconnect.
    await runAsSystem("mark whatsapp number disconnected", () =>
      this.deps.prisma.messagingInstallation.update({
        where: { id },
        data: { status: "disconnected" },
      }),
    ).catch((error: unknown) => getLogger().error("whatsapp status update failed", error));
    const running = this.running.get(id);
    this.running.delete(id);
    if (running) await safeRelease(running.release);
  }

  private async deliver(id: string, message: WhatsAppIncoming) {
    try {
      const row = await runAsSystem("read linked whatsapp number", () =>
        this.deps.prisma.messagingInstallation.findUnique({ where: { id } }),
      );
      if (!row) {
        // The number was deleted (an agent's deletion removes it): log the device out and stop.
        const running = this.running.get(id);
        this.running.delete(id);
        if (running) {
          await running.client.logout().catch(() => undefined);
          await running.client.close().catch(() => undefined);
          await safeRelease(running.release);
        }
        return;
      }
      if (row.status !== "active") return;
      // What this surface sent comes back as the number's own message: it is not the owner.
      if (this.sentIds.has(message.messageId)) return;
      const audience = classifyIncoming(message, {
        paused: row.pausedAt !== null,
        linkedAt: row.createdAt,
        resumedAt: row.resumedAt ?? undefined,
        now: this.now(),
      });
      if (audience === "ignore") return;
      // Nothing to do with the owner's own old notes.
      if (audience === "record" && message.chat.kind === "self") return;
      const media = message.media;
      const event: MessagingInboundMessage = {
        type: "message",
        provider: WHATSAPP_LINK_PROVIDER,
        handle: message.messageId,
        threadId: `${WHATSAPP_LINK_PROVIDER}:${id}:${message.chat.id}`,
        isDirect: true,
        from: message.senderId,
        fromLabel: message.senderName ?? null,
        channelName: null,
        participants: [],
        content: message.text,
        mediaUrl: null,
        ...(media
          ? {
              attachments: [
                {
                  name: media.name ?? extensionFor(media.mimeType),
                  mimeType: media.mimeType,
                  size: media.size,
                  fetch: media.download,
                },
              ],
            }
          : {}),
        installationId: id,
        installationSpaceId: row.spaceId,
        installationBotId: row.botId,
        audience,
      };
      await this.sink?.(event);
    } catch (error) {
      getLogger().error("whatsapp inbound failed", error);
    }
  }

  // ---- managing numbers ----

  async pause(installationId: string): Promise<void> {
    await runAsSystem("pause whatsapp number", () =>
      this.deps.prisma.messagingInstallation.update({
        where: { id: installationId },
        data: { pausedAt: this.now() },
      }),
    );
  }

  async resume(installationId: string): Promise<void> {
    await runAsSystem("resume whatsapp number", () =>
      this.deps.prisma.messagingInstallation.update({
        where: { id: installationId },
        data: { pausedAt: null, resumedAt: this.now() },
      }),
    );
  }

  /** Logs the device out of WhatsApp, deletes the session and the number. */
  async disconnect(installationId: string): Promise<void> {
    const running = this.running.get(installationId);
    this.running.delete(installationId);
    this.waiting.delete(installationId);
    try {
      await running?.client.logout();
    } catch (error) {
      getLogger().warn("whatsapp logout failed; the session is deleted anyway", {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    await runAsSystem("delete linked whatsapp number", () =>
      this.deps.prisma.messagingInstallation.delete({ where: { id: installationId } }),
    );
    if (running) await safeRelease(running.release);
  }

  // ---- MessagingSurface ----

  private target(threadId: string): {
    installationId: string;
    client: WhatsAppLinkClient;
    chatId: string;
  } {
    const prefix = `${WHATSAPP_LINK_PROVIDER}:`;
    if (!threadId.startsWith(prefix)) throw new Error("Not a WhatsApp thread");
    const rest = threadId.slice(prefix.length);
    const split = rest.indexOf(":");
    const installationId = rest.slice(0, split);
    const running = this.running.get(installationId);
    if (split < 0 || !running) throw new Error("That WhatsApp number is not connected here");
    return { installationId, client: running.client, chatId: rest.slice(split + 1) };
  }

  async sendToThread(
    request: MessagingSendRequest,
    _context: AdapterContext,
  ): Promise<MessagingSendResult> {
    const { installationId, client, chatId } = this.target(request.threadId);
    await this.pacer.beforeSend(installationId, client, chatId, request.body);
    const sent = await client.sendText(chatId, request.body);
    this.sentIds.add(sent.id);
    // Bounded: only the most recent matter, since an echo arrives within moments.
    if (this.sentIds.size > 500) {
      const oldest = this.sentIds.values().next().value;
      if (oldest !== undefined) this.sentIds.delete(oldest);
    }
    return { handle: sent.id };
  }

  /** Whether this process holds the number a thread belongs to: only it can send there. */
  holds(threadId: string): boolean {
    if (!threadId.startsWith(WHATSAPP_THREAD_PREFIX)) return false;
    const rest = threadId.slice(WHATSAPP_THREAD_PREFIX.length);
    return this.running.has(rest.slice(0, rest.indexOf(":")));
  }

  async openDirectThread(): Promise<string> {
    throw new Error("A WhatsApp conversation starts when the other person writes first");
  }

  async acknowledge(threadId: string, handle: string, _context?: AdapterContext): Promise<void> {
    const { client, chatId } = this.target(threadId);
    await client.markRead(chatId, handle).catch(() => undefined);
  }
}
