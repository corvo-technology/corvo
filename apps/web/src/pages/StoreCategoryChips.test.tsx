// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { StoreCategoryChips } from "./StoreCategoryChips";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({
    t: (parts: TemplateStringsArray) => parts.join(""),
  }),
}));
vi.mock("@corvo/ui-web", async () => {
  const { createElement } = await import("react");
  return {
    Button: ({
      children,
      onClick,
      ...rest
    }: {
      children: ReactNode;
      onClick?: () => void;
      "aria-pressed"?: boolean;
    }) => createElement("button", { onClick, ...rest }, children),
  };
});

async function mount(props: Parameters<typeof StoreCategoryChips>[0]) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<StoreCategoryChips {...props} />));
  return { host, unmount: () => act(async () => root.unmount()) };
}
const buttons = (host: HTMLElement) =>
  Array.from(host.querySelectorAll("button")).map((button) => button.textContent);

it("offers All first and then only the categories it is given, named in plain words", async () => {
  const { host, unmount } = await mount({
    categories: ["finance", "knowledge"],
    value: null,
    onChange: vi.fn(),
  });
  expect(buttons(host)).toEqual(["All", "Finance", "Research and writing"]);
  await unmount();
});

it("marks the chosen category as pressed, and All when none is chosen", async () => {
  const none = await mount({ categories: ["finance"], value: null, onChange: vi.fn() });
  const pressed = (host: HTMLElement) =>
    Array.from(host.querySelectorAll("button"))
      .filter((button) => button.getAttribute("aria-pressed") === "true")
      .map((button) => button.textContent);
  expect(pressed(none.host)).toEqual(["All"]);
  await none.unmount();
  const chosen = await mount({ categories: ["finance"], value: "finance", onChange: vi.fn() });
  expect(pressed(chosen.host)).toEqual(["Finance"]);
  await chosen.unmount();
});

it("reports a choice, and null when All is pressed", async () => {
  const onChange = vi.fn();
  const { host, unmount } = await mount({ categories: ["design"], value: "design", onChange });
  await act(async () => (host.querySelectorAll("button")[1] as HTMLButtonElement).click());
  expect(onChange).toHaveBeenLastCalledWith("design");
  await act(async () => (host.querySelectorAll("button")[0] as HTMLButtonElement).click());
  expect(onChange).toHaveBeenLastCalledWith(null);
  await unmount();
});
