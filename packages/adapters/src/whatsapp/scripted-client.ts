import type {
  WhatsAppAuthStore,
  WhatsAppConnectionEvent,
  WhatsAppIncoming,
  WhatsAppLinkClient,
} from "./client.js";

/** A session held in memory, for tests. */
export class MemoryWhatsAppAuthStore implements WhatsAppAuthStore {
  private readonly values = new Map<string, string>();
  async get(name: string) {
    return this.values.get(name);
  }
  async set(name: string, value: string | undefined) {
    if (value === undefined) this.values.delete(name);
    else this.values.set(name, value);
  }
  async clear() {
    this.values.clear();
  }
}

/** A client a test drives by hand: it never touches WhatsApp. */
export class ScriptedWhatsAppClient implements WhatsAppLinkClient {
  readonly sent: Array<{ chatId: string; text: string }> = [];
  readonly typing: Array<{ chatId: string; on: boolean }> = [];
  readonly read: Array<{ chatId: string; messageId: string }> = [];
  connected = false;
  private readonly connectionListeners: Array<(event: WhatsAppConnectionEvent) => void> = [];
  private readonly messageListeners: Array<(message: WhatsAppIncoming) => void> = [];
  private counter = 0;

  constructor(private readonly auth: WhatsAppAuthStore) {}

  async connect() {
    this.connected = true;
  }
  onConnection(callback: (event: WhatsAppConnectionEvent) => void) {
    this.connectionListeners.push(callback);
  }
  onMessage(callback: (message: WhatsAppIncoming) => void) {
    this.messageListeners.push(callback);
  }
  async sendText(chatId: string, text: string) {
    this.sent.push({ chatId, text });
    this.counter += 1;
    return { id: `sent-${this.counter}` };
  }
  async setTyping(chatId: string, on: boolean) {
    this.typing.push({ chatId, on });
  }
  async markRead(chatId: string, messageId: string) {
    this.read.push({ chatId, messageId });
  }
  async logout() {
    await this.auth.clear();
    this.connected = false;
    this.emitConnection({ state: "closed", reason: "logged-out" });
  }
  async close() {
    this.connected = false;
  }

  emitConnection(event: WhatsAppConnectionEvent) {
    for (const listener of this.connectionListeners) listener(event);
  }
  emitMessage(message: WhatsAppIncoming) {
    for (const listener of this.messageListeners) listener(message);
  }
}
