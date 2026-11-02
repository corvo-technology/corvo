import { CONTEXT_AUTO_COMPRESS_PERCENT } from "@corvo/core";
import { describe, expect, it } from "vitest";
import { contextMeterView, formatTokens } from "./context-meter";

describe("contextMeterView", () => {
  it("is the share of the window used, rounded, and warns from the threshold up", () => {
    expect(contextMeterView(32_000, 128_000)).toEqual({ percent: 25, warn: false });
    expect(contextMeterView(96_000, 128_000)).toEqual({
      percent: CONTEXT_AUTO_COMPRESS_PERCENT,
      warn: true,
    });
  });

  it("never shows more than a full window", () => {
    expect(contextMeterView(300_000, 200_000)).toEqual({ percent: 100, warn: true });
  });

  it("has no percentage, and no warning, when the window is unknown", () => {
    expect(contextMeterView(5_000, null)).toEqual({ percent: null, warn: false });
  });
});

describe("formatTokens", () => {
  it("shortens thousands and millions", () => {
    expect(formatTokens(950, "en")).toBe("950");
    expect(formatTokens(54_300, "en")).toBe("54.3K");
    expect(formatTokens(1_250_000, "en")).toBe("1.3M");
  });
});
