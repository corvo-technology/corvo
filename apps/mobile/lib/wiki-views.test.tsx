// @vitest-environment jsdom

import type { WikiPage, WikiPageInfo } from "@corvo/contracts";
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
  FlatList: ({
    data,
    renderItem,
  }: {
    data: unknown[];
    renderItem: (info: { item: unknown; index: number }) => ReactNode;
  }) =>
    createElement(
      "div",
      null,
      data.map((item, index) => renderItem({ item, index })),
    ),
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
vi.mock("@corvo/chat-ui/native", () => ({
  ChatMarkdown: ({
    children,
    renderMention,
  }: {
    children: string;
    renderMention: (id: string, name: ReactNode) => ReactNode;
  }) =>
    createElement(
      "div",
      null,
      children.split(/(\[[^\]]+\]\(corvo-mention:[^)]+\))/).map((part, index) => {
        const link = part.match(/^\[([^\]]+)\]\(corvo-mention:([^)]+)\)$/);
        return createElement(
          "span",
          { key: index },
          link ? renderMention(decodeURIComponent(link[2]!), link[1]) : part,
        );
      }),
    ),
}));

import { WikiList, WikiPageView } from "../components/wiki-views";
import { groupWikiPages } from "./wiki";

const info = (title: string, kind: string): WikiPageInfo => ({
  title,
  path: `${title}.md`,
  kind,
  summary: `About ${title}.`,
  revision: 1,
  updatedAt: "2026-11-04T10:00:00.000Z",
});

let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.replaceChildren(host);
});
const render = async (node: ReactNode) => {
  const root = createRoot(host);
  await act(async () => root.render(node));
  return () => act(async () => root.unmount());
};
const buttons = () => [...host.querySelectorAll("button")];

it("lists the pages under their kind, each with what it is about, and opens one", async () => {
  const open = vi.fn();
  const unmount = await render(
    createElement(WikiList, {
      groups: groupWikiPages([
        info("Ana", "Person"),
        info("Plan", "Project"),
        info("Zed", "Person"),
      ]),
      onOpen: open,
    }),
  );
  expect(host.textContent).toBe("PersonAnaAbout Ana.ZedAbout Zed.ProjectPlanAbout Plan.");
  await act(async () =>
    buttons()
      .find((b) => b.textContent?.startsWith("Plan"))!
      .click(),
  );
  expect(open).toHaveBeenCalledWith("Plan");
  await unmount();
});

it("shows a page's text, follows a link to a page that exists, and shows a missing one as text", async () => {
  const open = vi.fn();
  const pages = [info("Plan", "Project"), info("Ana Souza", "Person")];
  const page: WikiPage = {
    ...pages[0]!,
    body: "---\ntype: Project\n---\nOwner: [[Ana Souza]]. Blocked on [[Budget]].",
    links: ["Ana Souza", "Budget"],
    missing: ["Budget"],
    backlinks: ["Hub"],
  };
  const unmount = await render(createElement(WikiPageView, { page, pages, onOpen: open }));
  expect(host.textContent).toContain("Blocked on Budget.");
  expect(host.textContent).not.toContain("type: Project");
  // A link inside the text is a piece of text that can be pressed; a citing page is a button.
  const mentions = (name: string) =>
    [...host.querySelectorAll("span")].filter((node) => node.textContent === name);
  await act(async () => mentions("Ana Souza").at(-1)!.click());
  expect(open).toHaveBeenLastCalledWith("Ana Souza");
  expect(buttons().map((b) => b.textContent)).toEqual(["Hub"]);
  await act(async () => buttons()[0]!.click());
  expect(open).toHaveBeenLastCalledWith("Hub");
  expect(host.querySelector('[aria-label="Cited by"]')).toBeTruthy();
  await unmount();
});

it("shows no list of citing pages when no page cites it", async () => {
  const page: WikiPage = {
    ...info("Solo", "Other"),
    body: "Alone.",
    links: [],
    missing: [],
    backlinks: [],
  };
  const unmount = await render(createElement(WikiPageView, { page, pages: [], onOpen: vi.fn() }));
  expect(host.querySelector('[aria-label="Cited by"]')).toBeNull();
  await unmount();
});
