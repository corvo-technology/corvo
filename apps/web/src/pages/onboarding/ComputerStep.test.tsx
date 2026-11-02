// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({ computer: {} }));
const chooseHostComputer = vi.hoisted(() => vi.fn());
vi.mock("../../lib/desktop", () => ({ desktopBridge: () => bridge }));
vi.mock("../../lib/host-computer", () => ({ chooseHostComputer }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, "");
  return {
    useLingui: () => ({ t }),
    Trans: ({ children }: { children: ReactNode }) => children,
  };
});

import { ComputerStep } from "./ComputerStep";

const onDone = vi.fn();
let container: HTMLDivElement;
let root: Root;

function button(name: string) {
  const found = [...container.querySelectorAll("button")].find((b) => b.textContent === name);
  if (!found) throw new Error(`no button ${name}`);
  return found;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  chooseHostComputer.mockReset().mockResolvedValue(true);
  onDone.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<ComputerStep hostLabel="this Mac" onDone={onDone} />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ComputerStep", () => {
  it("starts on Docker, the isolated choice", () => {
    expect(button("Docker").getAttribute("aria-pressed")).toBe("true");
    expect(button("Use this Mac").getAttribute("aria-pressed")).toBe("false");
  });

  it("saves Docker by default and moves on", async () => {
    await act(async () => button("Continue").click());
    expect(chooseHostComputer).toHaveBeenCalledWith(bridge, "docker");
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("stays when the native confirmation for this Mac is declined", async () => {
    chooseHostComputer.mockResolvedValue(false);
    await act(async () => button("Use this Mac").click());
    await act(async () => button("Continue").click());
    expect(chooseHostComputer).toHaveBeenCalledWith(bridge, "this-mac");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("shows an error and stays when saving fails", async () => {
    chooseHostComputer.mockRejectedValue(new Error("down"));
    await act(async () => button("Continue").click());
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("saves once on a double click", async () => {
    await act(async () => {
      button("Continue").click();
      button("Continue").click();
    });
    expect(chooseHostComputer).toHaveBeenCalledOnce();
  });
});
