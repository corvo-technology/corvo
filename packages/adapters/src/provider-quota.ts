import type { PrismaClient } from "@corvo/db";

export type QuotaWindowKey = "5h" | "7d";
export type QuotaWindow = {
  key: QuotaWindowKey;
  /** 0 to 100. */
  usedPercent: number;
  /** When the provider says the window starts over, as an ISO time. */
  resetsAt: string;
};

/** The subscription providers whose answers carry the person's windows. */
export const QUOTA_PROVIDERS = ["anthropic", "openai-codex"] as const;

/** Kept between 0 and 100 and to one decimal, so 0.58 reads as 58 and not 57.99999999999999. */
const clampPercent = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
const number = (value: string | undefined) => {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function lower(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) result[name.toLowerCase()] = value;
  return result;
}

/** Claude reports each window as a 0-1 fraction and the Unix second it resets. */
function claudeWindows(headers: Record<string, string>): QuotaWindow[] {
  const windows: QuotaWindow[] = [];
  for (const key of ["5h", "7d"] as const) {
    const used = number(headers[`anthropic-ratelimit-unified-${key}-utilization`]);
    const reset = number(headers[`anthropic-ratelimit-unified-${key}-reset`]);
    if (used === null || reset === null) continue;
    windows.push({
      key,
      usedPercent: clampPercent(used * 100),
      resetsAt: new Date(reset * 1000).toISOString(),
    });
  }
  return windows;
}

/** ChatGPT's Codex reports a primary and a secondary window by percent, length and time to reset. */
function codexWindows(headers: Record<string, string>, now: Date): QuotaWindow[] {
  const windows: QuotaWindow[] = [];
  for (const slot of ["primary", "secondary"] as const) {
    const used = number(headers[`x-codex-${slot}-used-percent`]);
    if (used === null) continue;
    const minutes = number(headers[`x-codex-${slot}-window-minutes`]);
    const resetAt = number(headers[`x-codex-${slot}-reset-at`]);
    const resetAfter = number(headers[`x-codex-${slot}-reset-after-seconds`]);
    const resetMs =
      resetAt !== null
        ? resetAt * 1000
        : resetAfter !== null
          ? now.getTime() + resetAfter * 1000
          : null;
    if (resetMs === null) continue;
    // The shorter window is the one that resets within the day; a week-long one is the weekly cap.
    const key: QuotaWindowKey =
      minutes !== null ? (minutes <= 24 * 60 ? "5h" : "7d") : slot === "primary" ? "5h" : "7d";
    windows.push({
      key,
      usedPercent: clampPercent(used),
      resetsAt: new Date(resetMs).toISOString(),
    });
  }
  return windows;
}

/** The windows a provider's answer reports, or null when it reports none. Never throws on odd headers. */
export function parseQuotaHeaders(
  provider: string,
  rawHeaders: Record<string, string>,
  now = new Date(),
): QuotaWindow[] | null {
  const headers = lower(rawHeaders);
  const windows =
    provider === "anthropic"
      ? claudeWindows(headers)
      : provider === "openai-codex"
        ? codexWindows(headers, now)
        : [];
  return windows.length > 0 ? windows : null;
}

/** Keeps the latest reading for a person and provider. */
export async function recordProviderQuota(
  prisma: PrismaClient,
  scope: { spaceId: string; userId: string },
  provider: string,
  windows: QuotaWindow[],
): Promise<void> {
  await prisma.providerQuota.upsert({
    where: { spaceId_userId_provider: { ...scope, provider } },
    create: { ...scope, provider, windows },
    update: { windows },
  });
}
