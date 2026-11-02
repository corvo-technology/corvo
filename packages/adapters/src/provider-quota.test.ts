import { describe, expect, it } from "vitest";
import { parseQuotaHeaders } from "./provider-quota.js";

const NOW = new Date("2026-11-02T12:00:00Z");

describe("Claude", () => {
  it("reads the 5 hour and week windows from the unified headers", () => {
    const windows = parseQuotaHeaders(
      "anthropic",
      {
        "Anthropic-Ratelimit-Unified-5h-Utilization": "0.34",
        "anthropic-ratelimit-unified-5h-reset": "1793620800",
        "anthropic-ratelimit-unified-7d-utilization": "0.58",
        "anthropic-ratelimit-unified-7d-reset": "1794000000",
      },
      NOW,
    );
    expect(windows).toEqual([
      { key: "5h", usedPercent: 34, resetsAt: "2026-11-02T12:00:00.000Z" },
      { key: "7d", usedPercent: 58, resetsAt: new Date(1794000000 * 1000).toISOString() },
    ]);
  });

  it("keeps a window that is over its limit at 100", () => {
    const windows = parseQuotaHeaders("anthropic", {
      "anthropic-ratelimit-unified-5h-utilization": "1.2",
      "anthropic-ratelimit-unified-5h-reset": "1793620800",
    });
    expect(windows?.[0]?.usedPercent).toBe(100);
  });

  it("reports nothing when the answer has no such headers, as an API key's does", () => {
    expect(parseQuotaHeaders("anthropic", { "content-type": "text/event-stream" })).toBeNull();
  });

  it("skips a window that has a figure but no reset time", () => {
    expect(
      parseQuotaHeaders("anthropic", { "anthropic-ratelimit-unified-5h-utilization": "0.5" }),
    ).toBeNull();
  });
});

describe("ChatGPT", () => {
  it("names the window by its length and works the reset out from seconds", () => {
    const windows = parseQuotaHeaders(
      "openai-codex",
      {
        "x-codex-primary-used-percent": "12",
        "x-codex-primary-window-minutes": "300",
        "x-codex-primary-reset-after-seconds": "3600",
        "x-codex-secondary-used-percent": "41.5",
        "x-codex-secondary-window-minutes": "10080",
        "x-codex-secondary-reset-at": "1794000000",
      },
      NOW,
    );
    expect(windows).toEqual([
      { key: "5h", usedPercent: 12, resetsAt: "2026-11-02T13:00:00.000Z" },
      { key: "7d", usedPercent: 41.5, resetsAt: new Date(1794000000 * 1000).toISOString() },
    ]);
  });

  it("falls back to primary as the short window and secondary as the week", () => {
    const windows = parseQuotaHeaders(
      "openai-codex",
      {
        "x-codex-primary-used-percent": "5",
        "x-codex-primary-reset-after-seconds": "60",
        "x-codex-secondary-used-percent": "9",
        "x-codex-secondary-reset-after-seconds": "600",
      },
      NOW,
    );
    expect(windows?.map((w) => w.key)).toEqual(["5h", "7d"]);
  });
});

describe("any other provider", () => {
  it("reports nothing and ignores junk", () => {
    expect(parseQuotaHeaders("openrouter", { "x-ratelimit-remaining": "3" })).toBeNull();
    expect(
      parseQuotaHeaders("anthropic", {
        "anthropic-ratelimit-unified-5h-utilization": "lots",
        "anthropic-ratelimit-unified-5h-reset": "soon",
      }),
    ).toBeNull();
  });
});
