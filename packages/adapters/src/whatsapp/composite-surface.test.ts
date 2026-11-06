import type { MessagingInboundEvent, MessagingSurface } from "@corvo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import { CompositeMessagingSurface } from "./composite-surface.js";

function fakeSurface(provider: string) {
  let sink: ((event: MessagingInboundEvent) => Promise<void>) | undefined;
  const surface = {
    describe: () => ({
      id: provider,
      contractVersion: "1",
      adapterVersion: "1",
      capabilities: { providers: [provider] },
    }),
    platforms: () => [{ provider, capabilities: { direct: true, groups: false, receipt: null } }],
    handleWebhook: vi.fn((name: string) =>
      name === provider ? Promise.resolve(new Response("ok")) : null,
    ),
    onInbound: vi.fn((next: typeof sink) => {
      sink = next;
    }),
    sendToThread: vi.fn(async () => ({ handle: `${provider}-handle` })),
    openDirectThread: vi.fn(async () => `${provider}:direct`),
    acknowledge: vi.fn(async () => undefined),
    initialize: vi.fn(async () => undefined),
    shutdown: vi.fn(async () => undefined),
  } as unknown as MessagingSurface;
  return { surface, emit: (event: MessagingInboundEvent) => sink?.(event) };
}

const ctx = {} as never;

describe("CompositeMessagingSurface", () => {
  it("lists the platforms of both", () => {
    const composite = new CompositeMessagingSurface(
      fakeSurface("telegram").surface,
      fakeSurface("whatsapp-web").surface,
    );
    expect(composite.platforms().map((p) => p.provider)).toEqual(["telegram", "whatsapp-web"]);
  });

  it("works with no other platform at all", () => {
    const composite = new CompositeMessagingSurface(undefined, fakeSurface("whatsapp-web").surface);
    expect(composite.platforms().map((p) => p.provider)).toEqual(["whatsapp-web"]);
    expect(composite.handleWebhook("telegram", new Request("http://x"))).toBeNull();
  });

  it("sends a WhatsApp thread through the linked-number surface and any other through the base", async () => {
    const base = fakeSurface("telegram");
    const wa = fakeSurface("whatsapp-web");
    const composite = new CompositeMessagingSurface(base.surface, wa.surface);
    expect(
      await composite.sendToThread({ threadId: "whatsapp-web:inst:chat", body: "hi" }, ctx),
    ).toEqual({ handle: "whatsapp-web-handle" });
    expect(await composite.sendToThread({ threadId: "telegram:1", body: "hi" }, ctx)).toEqual({
      handle: "telegram-handle",
    });
    expect(wa.surface.sendToThread).toHaveBeenCalledTimes(1);
    expect(base.surface.sendToThread).toHaveBeenCalledTimes(1);
  });

  it("acknowledges and opens threads by provider", async () => {
    const base = fakeSurface("telegram");
    const wa = fakeSurface("whatsapp-web");
    const composite = new CompositeMessagingSurface(base.surface, wa.surface);
    await composite.acknowledge("whatsapp-web:i:c", "h", ctx);
    await composite.acknowledge("telegram:1", "h", ctx);
    expect(wa.surface.acknowledge).toHaveBeenCalledTimes(1);
    expect(base.surface.acknowledge).toHaveBeenCalledTimes(1);
    expect(await composite.openDirectThread("telegram", "1", ctx)).toBe("telegram:direct");
    await expect(composite.openDirectThread("whatsapp-web", "1", ctx)).resolves.toBe(
      "whatsapp-web:direct",
    );
  });

  it("routes webhooks to the base only, and gives both the one inbound sink", async () => {
    const base = fakeSurface("telegram");
    const wa = fakeSurface("whatsapp-web");
    const composite = new CompositeMessagingSurface(base.surface, wa.surface);
    expect(composite.handleWebhook("whatsapp-web", new Request("http://x"))).toBeNull();
    expect(composite.handleWebhook("telegram", new Request("http://x"))).not.toBeNull();
    const sink = vi.fn(async () => undefined);
    composite.onInbound(sink);
    await wa.emit({ type: "message" } as MessagingInboundEvent);
    await base.emit({ type: "message" } as MessagingInboundEvent);
    expect(sink).toHaveBeenCalledTimes(2);
  });

  it("starts and stops both, and one failing to start does not stop the other", async () => {
    const base = fakeSurface("telegram");
    const wa = fakeSurface("whatsapp-web");
    (base.surface.initialize as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("telegram down"),
    );
    const composite = new CompositeMessagingSurface(base.surface, wa.surface);
    await expect(composite.initialize()).rejects.toThrow("telegram down");
    expect(wa.surface.initialize).toHaveBeenCalledTimes(1);
    await composite.shutdown();
    expect(base.surface.shutdown).toHaveBeenCalled();
    expect(wa.surface.shutdown).toHaveBeenCalled();
  });
});
