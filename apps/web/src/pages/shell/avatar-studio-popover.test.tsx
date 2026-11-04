// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => text + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { BotLookPicker } from "./avatar-studio-popover";

const onChange = vi.fn();
beforeEach(() => {
  vi.useFakeTimers();
  onChange.mockReset();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});
afterEach(() => vi.useRealTimers());

async function mount(value: string) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<BotLookPicker value={value} onChange={onChange} />));
  return { host, unmount: () => act(async () => root.unmount()) };
}

const colorInput = (host: HTMLElement) =>
  host.querySelector<HTMLInputElement>('input[type="color"]') as HTMLInputElement;

async function pick(input: HTMLInputElement, hex: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, hex);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

it("keeps the ten swatches as they were, with the color of one's own apart from them", async () => {
  const { host, unmount } = await mount("#3B82F6");
  expect(host.querySelectorAll('[data-testid="avatar-studio-colors"] button')).toHaveLength(10);
  expect(host.querySelector('[data-testid="avatar-studio-colors"] input')).toBeNull();
  expect(colorInput(host).getAttribute("aria-label")).toBe("Custom color");
  await unmount();
});

it("marks the swatch that is worn, and no color of one's own", async () => {
  const { host, unmount } = await mount("#3B82F6");
  const pressed = [...host.querySelectorAll("button")].filter(
    (item) => item.getAttribute("aria-pressed") === "true",
  );
  expect(pressed.map((item) => item.getAttribute("aria-label"))).toEqual(["Color #3B82F6"]);
  expect(host.querySelector("[data-custom-color]")).toBeNull();
  await unmount();
});

it("marks a color of one's own, and no swatch, though a mascot is nearest to it", async () => {
  const { host, unmount } = await mount("#14B8A6");
  expect(
    [...host.querySelectorAll("button")].filter(
      (item) => item.getAttribute("aria-pressed") === "true",
    ),
  ).toHaveLength(0);
  expect(host.querySelector("[data-custom-color]")?.textContent).toContain("#14B8A6");
  expect(colorInput(host).value).toBe("#14b8a6");
  await unmount();
});

it("saves the color once the person stops choosing, not at every step of the drag", async () => {
  const { host, unmount } = await mount("#3B82F6");
  await pick(colorInput(host), "#112233");
  await pick(colorInput(host), "#223344");
  await pick(colorInput(host), "#334455");
  expect(onChange).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(500));
  expect(onChange).toHaveBeenCalledExactlyOnceWith("#334455");
  await unmount();
});

it("saves right away when the picker loses focus", async () => {
  const { host, unmount } = await mount("#3B82F6");
  await pick(colorInput(host), "#445566");
  await act(async () => {
    colorInput(host).dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  });
  expect(onChange).toHaveBeenCalledExactlyOnceWith("#445566");
  await act(async () => vi.advanceTimersByTime(500));
  expect(onChange).toHaveBeenCalledTimes(1);
  await unmount();
});

it("opens the picker on the color being worn, also for a short hex and for a photo", async () => {
  const short = await mount("#1b8");
  expect(colorInput(short.host).value).toBe("#11bb88");
  await short.unmount();
  const photo = await mount("data:image/webp;base64,AAAA");
  expect(colorInput(photo.host).value).toMatch(/^#[0-9a-f]{6}$/);
  expect(photo.host.querySelector("[data-custom-color]")).toBeNull();
  await photo.unmount();
});
