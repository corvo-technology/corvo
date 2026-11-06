import type {
  AdapterContext,
  MessagingInboundEvent,
  MessagingInboundMessage,
  MessagingSendRequest,
  MessagingSendResult,
  MessagingSurface,
} from "@corvo/adapter-kit";
import { WHATSAPP_LINK_PROVIDER, WHATSAPP_THREAD_PREFIX } from "./link-surface.js";

/**
 * The platforms a deployment configures, and the linked WhatsApp numbers beside them, as the one
 * messaging surface the rest of the app talks to. A thread belongs to the linked-number surface
 * when its id says so; everything else goes to the base surface as before.
 */
export class CompositeMessagingSurface implements MessagingSurface {
  constructor(
    private readonly base: MessagingSurface | undefined,
    private readonly whatsapp: MessagingSurface,
  ) {}

  private surfaceFor(threadId: string): MessagingSurface | undefined {
    return threadId.startsWith(WHATSAPP_THREAD_PREFIX) ? this.whatsapp : this.base;
  }

  describe() {
    const providers = this.platforms().map((platform) => platform.provider);
    return {
      id: "composite-messaging",
      contractVersion: "1",
      adapterVersion: "1",
      capabilities: { providers },
    };
  }

  platforms() {
    return [...(this.base?.platforms() ?? []), ...this.whatsapp.platforms()];
  }

  handleWebhook(provider: string, request: Request): Promise<Response> | null {
    // The linked-number surface has no webhook: its messages arrive over its own sockets.
    if (provider === WHATSAPP_LINK_PROVIDER) return null;
    return this.base?.handleWebhook(provider, request) ?? null;
  }

  onInbound(sink: (event: MessagingInboundEvent) => Promise<void>) {
    this.base?.onInbound(sink);
    this.whatsapp.onInbound(sink);
  }

  async sendToThread(
    request: MessagingSendRequest,
    context: AdapterContext,
  ): Promise<MessagingSendResult> {
    const surface = this.surfaceFor(request.threadId);
    if (!surface) throw new Error("No messaging platform is configured for that thread");
    return surface.sendToThread(request, context);
  }

  async openDirectThread(provider: string, address: string, context: AdapterContext) {
    const surface = provider === WHATSAPP_LINK_PROVIDER ? this.whatsapp : this.base;
    if (!surface) throw new Error("No messaging platform is configured for that provider");
    return surface.openDirectThread(provider, address, context);
  }

  async acknowledge(threadId: string, handle: string, context: AdapterContext) {
    await this.surfaceFor(threadId)?.acknowledge(threadId, handle, context);
  }

  async fetchThreadHistory(
    threadId: string,
    options: { before: string; limit: number },
    context: AdapterContext,
  ): Promise<MessagingInboundMessage[]> {
    const surface = this.surfaceFor(threadId);
    return surface?.fetchThreadHistory?.(threadId, options, context) ?? [];
  }

  async initialize(): Promise<void> {
    // One failing to start must not stop the other.
    const results = await Promise.allSettled([
      this.base?.initialize?.(),
      this.whatsapp.initialize?.(),
    ]);
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  }

  async shutdown(): Promise<void> {
    await Promise.allSettled([this.base?.shutdown?.(), this.whatsapp.shutdown?.()]);
  }
}
