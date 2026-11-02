import type { ThreadMessage } from "@corvo/contracts";
import { isPeerReceiptBlocks } from "@corvo/core";

/** Messages from the same agent this close together read as one, as they do in a chat room. */
export const SAME_SPEAKER_WINDOW_MS = 5 * 60_000;

type Spoken = Pick<ThreadMessage, "id" | "role" | "botId" | "createdAt" | "blocks">;

/**
 * The messages that carry on from the one before: the same agent speaking again within a few
 * minutes, with nothing between them (a day marker, the unread line, someone else, a hand-off
 * receipt). They show no name or face of their own.
 */
export function continuedMessageIds(
  messages: readonly Spoken[],
  breaks: (messageId: string) => boolean,
): Set<string> {
  const continued = new Set<string>();
  let previous: Spoken | null = null;
  for (const message of messages) {
    if (message.role !== "bot" || !message.botId || isPeerReceiptBlocks(message.blocks)) {
      previous = null;
      continue;
    }
    if (
      previous &&
      previous.botId === message.botId &&
      !breaks(message.id) &&
      new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() <
        SAME_SPEAKER_WINDOW_MS
    ) {
      continued.add(message.id);
    }
    previous = message;
  }
  return continued;
}
