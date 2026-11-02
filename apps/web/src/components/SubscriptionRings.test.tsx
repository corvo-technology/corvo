// @vitest-environment jsdom
import type { SubscriptionQuota } from "@corvo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((text, part, index) => text + part + (values[index] ?? ""), ""),
    i18n: { locale: "en" },
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../lib/query", () => ({ useSpaceQueries: () => ({}) }));

import { SubscriptionRings } from "./SubscriptionRings";

const NOW = new Date("2026-11-02T12:00:00Z");
const claude: SubscriptionQuota = {
  provider: "anthropic",
  readAt: "2026-11-02T11:57:00Z",
  windows: [
    { key: "5h", usedPercent: 34, resetsAt: "2026-11-02T14:00:00Z" },
    { key: "7d", usedPercent: 58, resetsAt: "2026-11-06T00:00:00Z" },
  ],
};

async function render(quotas: SubscriptionQuota[]) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  await act(async () => root.render(<SubscriptionRings quotas={quotas} now={NOW} />));
  return { host, root };
}

it("shows nothing until a subscription has reported", async () => {
  const { host, root } = await render([]);
  expect(host.innerHTML).toBe("");
  await act(async () => root.unmount());
});

it("gives each known subscription a ring that says how full it is, by the fuller window", async () => {
  const { host, root } = await render([claude]);
  const button = host.querySelector("button");
  expect(button?.getAttribute("aria-label")).toBe("Claude: 58% used");
  expect(host.querySelector(".stroke-destructive")).toBeNull();
  await act(async () => root.unmount());
});

it("turns the ring to the warning color when a window is nearly full", async () => {
  const full: SubscriptionQuota = {
    ...claude,
    windows: [{ key: "5h", usedPercent: 92, resetsAt: "2026-11-02T14:00:00Z" }],
  };
  const { host, root } = await render([full]);
  expect(host.querySelector(".stroke-destructive")).not.toBeNull();
  await act(async () => root.unmount());
});

it("leaves out a provider it cannot read windows for", async () => {
  const { host, root } = await render([{ ...claude, provider: "openrouter" }]);
  expect(host.innerHTML).toBe("");
  await act(async () => root.unmount());
});

it("counts a window whose reset has passed as empty", async () => {
  const stale: SubscriptionQuota = {
    ...claude,
    windows: [{ key: "5h", usedPercent: 90, resetsAt: "2026-11-02T11:00:00Z" }],
  };
  const { host, root } = await render([stale]);
  expect(host.querySelector("button")?.getAttribute("aria-label")).toBe("Claude: 0% used");
  await act(async () => root.unmount());
});
