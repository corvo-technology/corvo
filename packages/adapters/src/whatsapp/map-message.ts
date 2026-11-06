import type { WhatsAppIncoming, WhatsAppMedia } from "./client.js";

/** The parts of a Baileys message this adapter reads, so tests need not build a full proto. */
export interface RawWhatsAppMessage {
  key: {
    remoteJid?: string | null;
    fromMe?: boolean | null;
    id?: string | null;
    participant?: string | null;
  };
  message?: {
    conversation?: string | null;
    extendedTextMessage?: { text?: string | null } | null;
    imageMessage?: {
      caption?: string | null;
      mimetype?: string | null;
      fileLength?: number | { toNumber(): number } | null;
    } | null;
    audioMessage?: {
      mimetype?: string | null;
      fileLength?: number | { toNumber(): number } | null;
      ptt?: boolean | null;
    } | null;
    documentMessage?: {
      caption?: string | null;
      mimetype?: string | null;
      fileName?: string | null;
      fileLength?: number | { toNumber(): number } | null;
    } | null;
    reactionMessage?: unknown;
    protocolMessage?: unknown;
  } | null;
  messageTimestamp?: number | { toNumber(): number } | null;
  pushName?: string | null;
}

export interface MapOptions {
  /** The linked account's own ids: its phone JID and its LID. Device suffixes are ignored. */
  ownIds: readonly string[];
  /** The message came from a history replay, not a live delivery. */
  history: boolean;
  download(raw: RawWhatsAppMessage): Promise<Uint8Array>;
}

/** "15550001:7@s.whatsapp.net" and "15550001@s.whatsapp.net" are the same account. */
function userOf(jid: string): string {
  return jid.split("@")[0]?.split(":")[0] ?? jid;
}

const number = (value: number | { toNumber(): number } | null | undefined): number =>
  value == null ? 0 : typeof value === "number" ? value : value.toNumber();

function mediaOf(
  raw: RawWhatsAppMessage,
  download: MapOptions["download"],
): WhatsAppMedia | undefined {
  const message = raw.message;
  if (message?.audioMessage) {
    const audio = message.audioMessage;
    return {
      kind: "audio",
      mimeType: audio.mimetype ?? "audio/ogg",
      size: number(audio.fileLength),
      download: () => download(raw),
    };
  }
  if (message?.imageMessage) {
    const image = message.imageMessage;
    return {
      kind: "image",
      mimeType: image.mimetype ?? "image/jpeg",
      size: number(image.fileLength),
      download: () => download(raw),
    };
  }
  if (message?.documentMessage) {
    const doc = message.documentMessage;
    return {
      kind: "file",
      mimeType: doc.mimetype ?? "application/octet-stream",
      ...(doc.fileName ? { name: doc.fileName } : {}),
      size: number(doc.fileLength),
      download: () => download(raw),
    };
  }
  return undefined;
}

/** Normalizes one WhatsApp message, or returns undefined for anything that is not a person's message. */
export function mapIncoming(
  raw: RawWhatsAppMessage,
  options: MapOptions,
): WhatsAppIncoming | undefined {
  const message = raw.message;
  const remote = raw.key.remoteJid;
  if (!message || !remote || !raw.key.id) return undefined;
  if (message.reactionMessage || message.protocolMessage) return undefined;
  if (
    remote === "status@broadcast" ||
    remote.endsWith("@newsletter") ||
    remote.endsWith("@broadcast")
  ) {
    return undefined;
  }
  const media = mediaOf(raw, options.download);
  const text =
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.documentMessage?.caption ??
    "";
  if (!text && !media) return undefined;

  const own = new Set(options.ownIds.map(userOf));
  const kind = remote.endsWith("@g.us") ? "group" : own.has(userOf(remote)) ? "self" : "direct";
  const fromMe = Boolean(raw.key.fromMe);
  const senderId = raw.key.participant ?? (fromMe ? (options.ownIds[0] ?? remote) : remote);
  const seconds = number(raw.messageTimestamp);
  return {
    chat: { id: remote, kind },
    messageId: raw.key.id,
    senderId,
    ...(raw.pushName ? { senderName: raw.pushName } : {}),
    fromMe,
    text,
    ...(media ? { media } : {}),
    sentAt: new Date(seconds * 1000),
    history: options.history,
  };
}
