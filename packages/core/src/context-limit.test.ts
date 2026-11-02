import { describe, expect, it } from "vitest";
import { CONTEXT_AUTO_COMPRESS_PERCENT, contextNeedsCompression } from "./context-limit.js";

describe("contextNeedsCompression", () => {
  it("is true from the threshold up and false below it", () => {
    const window = 200_000;
    const at = (window * CONTEXT_AUTO_COMPRESS_PERCENT) / 100;
    expect(contextNeedsCompression({ usedTokens: at, windowTokens: window })).toBe(true);
    expect(contextNeedsCompression({ usedTokens: at - 1, windowTokens: window })).toBe(false);
  });

  it("never fires without knowing both the size and the window", () => {
    expect(contextNeedsCompression({ usedTokens: null, windowTokens: 100_000 })).toBe(false);
    expect(contextNeedsCompression({ usedTokens: 90_000, windowTokens: null })).toBe(false);
  });
});
