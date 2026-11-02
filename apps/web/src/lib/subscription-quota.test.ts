import type { SubscriptionQuota } from "@corvo/contracts";
import { describe, expect, it } from "vitest";
import {
  quotaPeak,
  quotaProviderLabel,
  quotaWarns,
  quotaWindowNow,
  relativeTime,
} from "./subscription-quota";

const NOW = new Date("2026-11-02T12:00:00Z");

describe("quotaWindowNow", () => {
  it("keeps a reading while its window is still running", () => {
    const window = { key: "5h" as const, usedPercent: 34, resetsAt: "2026-11-02T14:00:00Z" };
    expect(quotaWindowNow(window, NOW)).toMatchObject({ usedPercent: 34, startedOver: false });
  });

  it("empties a window whose reset time has passed since the reading", () => {
    const window = { key: "7d" as const, usedPercent: 90, resetsAt: "2026-11-02T11:00:00Z" };
    expect(quotaWindowNow(window, NOW)).toMatchObject({ usedPercent: 0, startedOver: true });
  });
});

describe("quotaPeak", () => {
  const quota: SubscriptionQuota = {
    provider: "anthropic",
    readAt: "2026-11-02T11:59:00Z",
    windows: [
      { key: "5h", usedPercent: 34, resetsAt: "2026-11-02T14:00:00Z" },
      { key: "7d", usedPercent: 58, resetsAt: "2026-11-06T00:00:00Z" },
    ],
  };
  it("is the fuller window", () => {
    expect(quotaPeak(quota, NOW)).toBe(58);
  });
  it("ignores a window that has started over", () => {
    const later = new Date("2026-11-07T00:00:00Z");
    expect(quotaPeak(quota, later)).toBe(0);
  });
});

it("warns from 85 percent", () => {
  expect(quotaWarns(84.9)).toBe(false);
  expect(quotaWarns(85)).toBe(true);
});

it("names only the providers it can read windows for", () => {
  expect(quotaProviderLabel("anthropic")).toBe("Claude");
  expect(quotaProviderLabel("openai-codex")).toBe("ChatGPT");
  expect(quotaProviderLabel("openrouter")).toBeNull();
});

describe("relativeTime", () => {
  it("picks the unit that keeps the number small", () => {
    expect(relativeTime("2026-11-02T12:40:00Z", NOW, "en")).toBe("in 40 minutes");
    expect(relativeTime("2026-11-02T14:00:00Z", NOW, "en")).toBe("in 2 hours");
    expect(relativeTime("2026-11-05T12:00:00Z", NOW, "en")).toBe("in 3 days");
    expect(relativeTime("2026-11-02T11:57:00Z", NOW, "en")).toBe("3 minutes ago");
  });
});
