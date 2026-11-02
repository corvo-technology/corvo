/** The latest time among the messages, or null when there are none. ISO times compare as text. */
export function newestCreatedAt(messages: ReadonlyArray<{ createdAt: string }>): string | null {
  let newest: string | null = null;
  for (const message of messages) {
    if (newest === null || message.createdAt > newest) newest = message.createdAt;
  }
  return newest;
}

/**
 * Whether a message arrived after the chat opened, so it may animate in. History loaded on scroll
 * is older than what the chat opened with, and a chat that opened empty has only new messages.
 */
export function isFreshMessage(
  message: { createdAt: string },
  openedWithNewest: string | null,
): boolean {
  return openedWithNewest === null || message.createdAt > openedWithNewest;
}
