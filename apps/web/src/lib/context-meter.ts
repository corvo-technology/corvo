import { CONTEXT_AUTO_COMPRESS_PERCENT } from "@corvo/core";

/** The meter warns where the server starts compressing on its own. */
export type ContextMeterView = {
  /** Null when the model's window is not known, so there is nothing to compare with. */
  percent: number | null;
  warn: boolean;
};

export function contextMeterView(
  usedTokens: number,
  windowTokens: number | null,
): ContextMeterView {
  if (!windowTokens) return { percent: null, warn: false };
  const percent = Math.min(100, Math.round((usedTokens / windowTokens) * 100));
  return { percent, warn: percent >= CONTEXT_AUTO_COMPRESS_PERCENT };
}

/** 1,234 reads as "1.2K"; small numbers stay whole. */
export function formatTokens(tokens: number, locale?: string): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(
    tokens,
  );
}
