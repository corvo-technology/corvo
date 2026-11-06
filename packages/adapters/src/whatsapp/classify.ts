import type { WhatsAppIncoming } from "./client.js";

/** A message delivered this long after it was sent is recorded, not answered. */
export const LATE_MESSAGE_MS = 10 * 60_000;

export type MessageAudience = "owner" | "visitor" | "record" | "ignore";

export interface NumberState {
  paused: boolean;
  /** When the number was linked; nothing sent before is answered. */
  linkedAt: Date;
  /** When the number was last resumed from a pause; nothing sent before is answered. */
  resumedAt?: Date | undefined;
  now: Date;
}

/**
 * Who a message is from and whether the agent may answer it. Answering a backlog is bulk sending,
 * which is what gets a number banned, so anything old, replayed or received while paused is only
 * recorded.
 */
export function classifyIncoming(message: WhatsAppIncoming, state: NumberState): MessageAudience {
  if (message.chat.kind === "group") return "ignore";
  if (!message.text && !message.media) return "ignore";
  const self = message.chat.kind === "self";
  // The owner talks to the agent only in their own chat; elsewhere they are talking to a person.
  if (self !== message.fromMe) return "ignore";

  const sent = message.sentAt.getTime();
  if (message.history || state.paused) return "record";
  if (sent < state.linkedAt.getTime()) return "record";
  if (state.resumedAt && sent < state.resumedAt.getTime()) return "record";
  if (state.now.getTime() - sent > LATE_MESSAGE_MS) return "record";
  return self ? "owner" : "visitor";
}
