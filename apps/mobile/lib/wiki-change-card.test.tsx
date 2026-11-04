// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";

const { shim } = vi.hoisted(() => ({
  shim:
    (tag: string) =>
    ({
      children,
      onPress,
      accessibilityLabel,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      accessibilityLabel?: string;
      testID?: string;
    }) =>
      createElement(
        tag,
        { "aria-label": accessibilityLabel, "data-testid": testID, onClick: onPress },
        children,
      ),
}));

vi.mock("react-native", () => ({
  FlatList: shim("div"),
  Pressable: shim("button"),
  ScrollView: shim("div"),
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: shim("span"),
  View: shim("div"),
}));
vi.mock("./i18n", () => ({ useI18n: () => ({ t: (text: string) => text }) }));
vi.mock("./native", () => ({
  native: new Proxy({}, { get: () => "color" }),
  useThemedStyles: (create: () => unknown) => create(),
  useResolvedAppearance: () => "light",
}));
vi.mock("./appearance", () => ({ mobileTokens: () => ({}) }));
vi.mock("./api", () => ({ rpc: vi.fn() }));
vi.mock("@corvo/chat-ui/native", () => ({ ChatMarkdown: shim("div") }));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => createElement("button", { type: "button", onClick: onPress, disabled }, label),
}));

import { WikiChangeCard } from "../components/wiki-views";

const change = {
  state: "pending" as const,
  reason: "A contractor was chosen",
  sourceTitle: "Lobby renovation",
  pages: [
    { title: "Alpha Builders", op: "create" as const },
    { title: "Plan", op: "replace" as const },
  ],
  canSeeSource: true,
  sourceText: "Ana: we are going with Alpha Builders.",
};

let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.replaceChildren(host);
});
async function render(props: Partial<Parameters<typeof WikiChangeCard>[0]> = {}) {
  const onDecide = vi.fn();
  const onOpenPage = vi.fn();
  const root = createRoot(host);
  await act(async () =>
    root.render(createElement(WikiChangeCard, { change, onDecide, onOpenPage, ...props })),
  );
  return { onDecide, onOpenPage, unmount: () => act(async () => root.unmount()) };
}
const labels = () => [...host.querySelectorAll("button")].map((b) => b.textContent);
const press = (label: string) =>
  act(async () =>
    [...host.querySelectorAll("button")].find((b) => b.textContent === label)!.click(),
  );

it("names the pages and, while the change waits, offers to approve or refuse it", async () => {
  const { onDecide, unmount } = await render();
  expect(host.textContent).toContain("Waiting for approval");
  expect(host.textContent).toContain("Alpha Builders");
  expect(host.textContent).toContain("A contractor was chosen");
  expect(labels()).toEqual(expect.arrayContaining(["Approve", "Refuse"]));
  expect(labels()).not.toContain("Undo");
  await press("Approve");
  expect(onDecide).toHaveBeenCalledWith("apply");
  await press("Refuse");
  expect(onDecide).toHaveBeenCalledWith("refuse");
  await unmount();
});

it("offers only to undo what was added", async () => {
  const { onDecide, unmount } = await render({ change: { ...change, state: "applied" } });
  expect(host.textContent).toContain("Added to the wiki");
  expect(labels()).toContain("Undo");
  expect(labels()).not.toContain("Approve");
  await press("Undo");
  expect(onDecide).toHaveBeenCalledWith("undo");
  await unmount();
});

it.each([
  ["refused", "Refused"],
  ["undone", "Undone"],
  ["conflict", "A page changed since"],
] as const)(
  "says only that it was %s, with nothing to press but the pages",
  async (state, text) => {
    const { unmount } = await render({ change: { ...change, state } });
    expect(host.textContent).toContain(text);
    expect(labels().filter((label) => ["Approve", "Refuse", "Undo"].includes(label ?? ""))).toEqual(
      [],
    );
    await unmount();
  },
);

it("opens a page when its name is pressed", async () => {
  const { onOpenPage, unmount } = await render();
  await act(async () =>
    [...host.querySelectorAll("button")].find((b) => b.textContent === "Plan")!.click(),
  );
  expect(onOpenPage).toHaveBeenCalledWith("Plan");
  await unmount();
});

it("holds the buttons while an answer is on its way", async () => {
  const { unmount } = await render({ busy: true });
  for (const button of host.querySelectorAll("button"))
    if (["Approve", "Refuse"].includes(button.textContent ?? ""))
      expect((button as HTMLButtonElement).disabled).toBe(true);
  await unmount();
});
