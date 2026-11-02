// @vitest-environment jsdom

import { SPACE_NAME_MAX_LENGTH } from "@corvo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rename = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({ rpc: { spaces: { rename } } }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});

import { WorkspaceStep } from "./WorkspaceStep";

const onDone = vi.fn();
let container: HTMLDivElement;
let root: Root;

function type(value: string) {
  const input = container.querySelector("input") as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit() {
  const form = container.querySelector("form") as HTMLFormElement;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  rename.mockReset().mockImplementation(async ({ name }: { name: string }) => ({ id: "s1", name }));
  onDone.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<WorkspaceStep spaceId="s1" initialName="Personal" onDone={onDone} />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("WorkspaceStep", () => {
  it("moves on without renaming when the name is unchanged", async () => {
    await submit();
    expect(rename).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith("Personal");
  });

  it("shows an error and saves nothing for a blank or too long name", async () => {
    for (const value of ["   ", "x".repeat(SPACE_NAME_MAX_LENGTH + 1)]) {
      type(value);
      await submit();
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
    }
    expect(rename).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("renames the space once and passes the saved name on", async () => {
    type("  Alves Studio ");
    await submit();
    await submit();
    expect(rename).toHaveBeenCalledWith({ spaceId: "s1", name: "Alves Studio" });
    expect(onDone).toHaveBeenCalledWith("Alves Studio");
  });

  it("stays on the step when the rename fails", async () => {
    rename.mockRejectedValueOnce(new Error("down"));
    type("Alves Studio");
    await submit();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(onDone).not.toHaveBeenCalled();
  });
});
