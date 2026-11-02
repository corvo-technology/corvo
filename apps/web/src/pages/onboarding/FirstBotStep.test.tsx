// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ensureFirstBot = vi.hoisted(() => vi.fn());
vi.mock("../../lib/first-bot", () => ({ ensureFirstBot }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});

import { FirstBotStep } from "./FirstBotStep";

const onReady = vi.fn();
let container: HTMLDivElement;
let root: Root;

async function mount() {
  await act(async () => {
    root.render(<FirstBotStep locale="pt-BR" onReady={onReady} />);
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ensureFirstBot.mockReset().mockResolvedValue({ id: "chief-1" });
  onReady.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("FirstBotStep", () => {
  it("makes sure the Chief exists, in the app's language, and moves on without asking anything", async () => {
    await mount();
    expect(ensureFirstBot).toHaveBeenCalledOnce();
    expect(ensureFirstBot).toHaveBeenCalledWith("pt-BR");
    expect(onReady).toHaveBeenCalledWith("chief-1");
    expect(container.querySelector("button")).toBeNull();
  });

  it("does not move on without the Chief, and retries making it", async () => {
    ensureFirstBot.mockRejectedValueOnce(new Error("offline"));
    await mount();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(onReady).not.toHaveBeenCalled();
    const retry = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Try again",
    );
    await act(async () => retry?.click());
    expect(ensureFirstBot).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(onReady).toHaveBeenCalledWith("chief-1");
  });
});
