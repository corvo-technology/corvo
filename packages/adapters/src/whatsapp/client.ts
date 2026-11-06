/**
 * What the Rook side needs from a linked WhatsApp number. The WhatsApp Web library behind it is an
 * adapter detail (see baileys-client.ts), so nothing else imports it.
 */

export interface WhatsAppChat {
  id: string;
  /** "self" is the number's own "Message yourself" chat. */
  kind: "self" | "direct" | "group";
}

export interface WhatsAppMedia {
  kind: "audio" | "image" | "file";
  mimeType: string;
  name?: string;
  size: number;
  download(): Promise<Uint8Array>;
}

export interface WhatsAppIncoming {
  chat: WhatsAppChat;
  messageId: string;
  senderId: string;
  senderName?: string;
  /** Typed by the linked number itself, from any of its devices. */
  fromMe: boolean;
  text: string;
  media?: WhatsAppMedia;
  sentAt: Date;
  /** Replayed by WhatsApp from before the link or while the app was offline. */
  history: boolean;
}

export type WhatsAppConnectionEvent =
  | { state: "qr"; qr: string }
  | { state: "open"; number: string }
  | { state: "closed"; reason: "logged-out" | "replaced" | "network" };

/** Where a number's session lives. Values are opaque strings; the store may encrypt them. */
export interface WhatsAppAuthStore {
  get(name: string): Promise<string | undefined>;
  /** Passing undefined deletes the entry. */
  set(name: string, value: string | undefined): Promise<void>;
  clear(): Promise<void>;
}

export interface WhatsAppLinkClient {
  connect(): Promise<void>;
  onConnection(callback: (event: WhatsAppConnectionEvent) => void): void;
  onMessage(callback: (message: WhatsAppIncoming) => void): void;
  sendText(chatId: string, text: string): Promise<{ id: string }>;
  setTyping(chatId: string, on: boolean): Promise<void>;
  markRead(chatId: string, messageId: string): Promise<void>;
  /** Unlinks the device from WhatsApp and deletes the session. */
  logout(): Promise<void>;
  /** Closes the socket and keeps the session. */
  close(): Promise<void>;
}

export type WhatsAppClientFactory = (auth: WhatsAppAuthStore) => WhatsAppLinkClient;
