/**
 * Past this share of the model's reading window, the older part of a chat is summarized on its
 * own after the turn. The meter warns at the same point, so the warning means "this is about
 * to happen".
 */
export const CONTEXT_AUTO_COMPRESS_PERCENT = 75;

/** Whether the last turn left the context past the point where it is compressed on its own. */
export function contextNeedsCompression(usage: {
  usedTokens: number | null;
  windowTokens: number | null;
}): boolean {
  if (usage.usedTokens === null || !usage.windowTokens) return false;
  return (usage.usedTokens / usage.windowTokens) * 100 >= CONTEXT_AUTO_COMPRESS_PERCENT;
}
