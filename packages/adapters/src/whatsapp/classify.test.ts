import { describe, expect, it } from "vitest";
import { classifyIncoming, LATE_MESSAGE_MS } from "./classify.js";
import type { WhatsAppIncoming } from "./client.js";

const now = new Date("2026-01-01T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const state = (over: Partial<Parameters<typeof classifyIncoming>[1]> = {}) => ({
  paused: false,
  linkedAt: ago(24 * 3_600_000),
  now,
  ...over,
});
const message = (over: Partial<WhatsAppIncoming> = {}): WhatsAppIncoming => ({
  chat: { id: "15550100@s.whatsapp.net", kind: "direct" },
  messageId: "m1",
  senderId: "15550100@s.whatsapp.net",
  fromMe: false,
  text: "hello",
  sentAt: ago(5_000),
  history: false,
  ...over,
});
const selfChat = (over: Partial<WhatsAppIncoming> = {}) =>
  message({ chat: { id: "15550001@s.whatsapp.net", kind: "self" }, fromMe: true, ...over });

describe("classifyIncoming", () => {
  it("treats a live message from someone else in a one-to-one chat as a visitor", () => {
    expect(classifyIncoming(message(), state())).toBe("visitor");
  });

  it("treats a live message in the self chat as the owner", () => {
    expect(classifyIncoming(selfChat(), state())).toBe("owner");
  });

  it("ignores groups, empty messages and the owner's own messages in other chats", () => {
    expect(classifyIncoming(message({ chat: { id: "g@g.us", kind: "group" } }), state())).toBe(
      "ignore",
    );
    expect(classifyIncoming(message({ text: "" }), state())).toBe("ignore");
    expect(classifyIncoming(message({ fromMe: true }), state())).toBe("ignore");
    expect(classifyIncoming(selfChat({ fromMe: false }), state())).toBe("ignore");
  });

  it("records history replays, for visitors and for the owner", () => {
    expect(classifyIncoming(message({ history: true }), state())).toBe("record");
    expect(classifyIncoming(selfChat({ history: true }), state())).toBe("record");
  });

  it("records a message from before the number was linked", () => {
    expect(classifyIncoming(message({ sentAt: ago(48 * 3_600_000) }), state())).toBe("record");
  });

  it("records everything while the number is paused, and what was sent before it resumed", () => {
    expect(classifyIncoming(message(), state({ paused: true }))).toBe("record");
    expect(classifyIncoming(selfChat(), state({ paused: true }))).toBe("record");
    const resumedAt = ago(1_000);
    expect(classifyIncoming(message({ sentAt: ago(60_000) }), state({ resumedAt }))).toBe("record");
    expect(classifyIncoming(message({ sentAt: ago(100) }), state({ resumedAt }))).toBe("visitor");
  });

  it("records a message delivered more than ten minutes after it was sent", () => {
    expect(LATE_MESSAGE_MS).toBe(10 * 60_000);
    expect(classifyIncoming(message({ sentAt: ago(11 * 60_000) }), state())).toBe("record");
    expect(classifyIncoming(message({ sentAt: ago(9 * 60_000) }), state())).toBe("visitor");
    expect(classifyIncoming(selfChat({ sentAt: ago(11 * 60_000) }), state())).toBe("record");
  });

  it("lets a media-only message through, since a voice note has no text", () => {
    const voice = message({
      text: "",
      media: {
        kind: "audio",
        mimeType: "audio/ogg",
        size: 1,
        download: async () => new Uint8Array(),
      },
    });
    expect(classifyIncoming(voice, state())).toBe("visitor");
  });
});
