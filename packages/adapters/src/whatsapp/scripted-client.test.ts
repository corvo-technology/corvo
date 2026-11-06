import { describe, expect, it } from "vitest";
import type { WhatsAppConnectionEvent, WhatsAppIncoming } from "./client.js";
import { MemoryWhatsAppAuthStore, ScriptedWhatsAppClient } from "./scripted-client.js";

const incoming = (over: Partial<WhatsAppIncoming> = {}): WhatsAppIncoming => ({
  chat: { id: "15550100@s.whatsapp.net", kind: "direct" },
  messageId: "m1",
  senderId: "15550100@s.whatsapp.net",
  fromMe: false,
  text: "hello",
  sentAt: new Date("2026-01-01T00:00:00Z"),
  history: false,
  ...over,
});

describe("ScriptedWhatsAppClient", () => {
  it("delivers connection events and messages to subscribers in order", async () => {
    const client = new ScriptedWhatsAppClient(new MemoryWhatsAppAuthStore());
    const seen: string[] = [];
    client.onConnection((event: WhatsAppConnectionEvent) => seen.push(event.state));
    client.onMessage((message) => seen.push(message.messageId));
    await client.connect();
    client.emitConnection({ state: "qr", qr: "qr-string" });
    client.emitMessage(incoming());
    client.emitConnection({ state: "open", number: "+15550100" });
    expect(seen).toEqual(["qr", "m1", "open"]);
  });

  it("records what it was asked to send, show and read", async () => {
    const client = new ScriptedWhatsAppClient(new MemoryWhatsAppAuthStore());
    const sent = await client.sendText("chat-1", "hi");
    await client.setTyping("chat-1", true);
    await client.markRead("chat-1", "m1");
    expect(sent.id).toBeTruthy();
    expect(client.sent).toEqual([{ chatId: "chat-1", text: "hi" }]);
    expect(client.typing).toEqual([{ chatId: "chat-1", on: true }]);
    expect(client.read).toEqual([{ chatId: "chat-1", messageId: "m1" }]);
  });

  it("logging out clears the session and reports a logged-out close", async () => {
    const auth = new MemoryWhatsAppAuthStore();
    await auth.set("creds", "secret");
    const client = new ScriptedWhatsAppClient(auth);
    const closes: string[] = [];
    client.onConnection((event) => {
      if (event.state === "closed") closes.push(event.reason);
    });
    await client.logout();
    expect(await auth.get("creds")).toBeUndefined();
    expect(closes).toEqual(["logged-out"]);
  });

  it("the memory auth store keeps, deletes and clears values", async () => {
    const auth = new MemoryWhatsAppAuthStore();
    await auth.set("a", "1");
    await auth.set("b", "2");
    await auth.set("a", undefined);
    expect(await auth.get("a")).toBeUndefined();
    expect(await auth.get("b")).toBe("2");
    await auth.clear();
    expect(await auth.get("b")).toBeUndefined();
  });
});
