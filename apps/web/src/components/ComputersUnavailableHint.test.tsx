// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const local = vi.hoisted(() => ({ value: false }));
vi.mock("../lib/local-edition", () => ({ useLocalEdition: () => local.value }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});

import { ComputersUnavailableHint } from "./ComputersUnavailableHint";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => root.render(<ComputersUnavailableHint sandboxProvider="none" />));
}

describe("ComputersUnavailableHint", () => {
  it("tells a server admin which settings to change", async () => {
    local.value = false;
    await render();
    expect(container.textContent).toContain("SANDBOX_PROVIDER");
    expect(container.textContent).toContain("Copy .env example");
  });

  it("tells a person on their own computer to choose where bots run, with no server settings", async () => {
    local.value = true;
    await render();
    expect(container.textContent).not.toContain("SANDBOX_PROVIDER");
    expect(container.textContent).not.toContain(".env");
    const choose = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Choose where bots run",
    );
    const opened = vi.fn();
    window.addEventListener("corvo:choose-computer", opened);
    act(() => choose?.click());
    window.removeEventListener("corvo:choose-computer", opened);
    expect(opened).toHaveBeenCalledOnce();
  });
});
