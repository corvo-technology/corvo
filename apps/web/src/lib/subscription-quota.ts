import type { QuotaWindowView, SubscriptionQuota } from "@corvo/contracts";

/** From this share of a window on, the ring turns to the warning color. */
export const QUOTA_WARN_PERCENT = 85;

const LABELS: Record<string, string> = { anthropic: "Claude", "openai-codex": "ChatGPT" };

/** The name a person knows a subscription by; null for a provider that has no windows to show. */
export const quotaProviderLabel = (provider: string): string | null => LABELS[provider] ?? null;

export type QuotaWindowNow = {
  key: QuotaWindowView["key"];
  usedPercent: number;
  /** The window started over after the last reading, so the figure no longer holds. */
  startedOver: boolean;
  resetsAt: string;
};

/** A reading as of now: once its reset time has passed, the window is empty again. */
export function quotaWindowNow(window: QuotaWindowView, now: Date): QuotaWindowNow {
  const startedOver = new Date(window.resetsAt).getTime() <= now.getTime();
  return {
    key: window.key,
    usedPercent: startedOver ? 0 : window.usedPercent,
    startedOver,
    resetsAt: window.resetsAt,
  };
}

export const quotaWarns = (percent: number) => percent >= QUOTA_WARN_PERCENT;

/** The fuller of a subscription's windows, which is the one that will stop the person first. */
export function quotaPeak(quota: SubscriptionQuota, now: Date): number {
  return Math.max(0, ...quota.windows.map((window) => quotaWindowNow(window, now).usedPercent));
}

/** "in 2 hours", "in 40 minutes", "in 3 days": the nearest unit that keeps the number small. */
export function relativeTime(target: string, now: Date, locale: string): string {
  const seconds = Math.round((new Date(target).getTime() - now.getTime()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "always", style: "long" });
  const abs = Math.abs(seconds);
  if (abs < 90 * 60) return formatter.format(Math.round(seconds / 60), "minute");
  if (abs < 36 * 3600) return formatter.format(Math.round(seconds / 3600), "hour");
  return formatter.format(Math.round(seconds / 86_400), "day");
}
