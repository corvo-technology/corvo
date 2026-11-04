// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn());
const decide = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock("./wiki", () => ({ getWikiChange: get, decideWikiChange: decide }));
vi.mock("expo-router", () => ({ router: { push } }));
// The card is tested on its own; this one shows its state and hands its buttons through.
vi.mock("../components/wiki-views", () => ({
  WikiChangeCard: ({
    change,
    busy,
    onDecide,
    onOpenPage,
  }: {
    change: { state: string; pages: { title: string }[] };
    busy: boolean;
    onDecide: (decision: "apply" | "refuse" | "undo") => void;
    onOpenPage: (title: string) => void;
  }) =>
    createElement(
      "div",
      { "data-state": change.state, "data-busy": String(busy) },
      createElement("button", { type: "button", onClick: () => onDecide("apply") }, "apply"),
      createElement(
        "button",
        { type: "button", onClick: () => onOpenPage(change.pages[0]!.title) },
        "open",
      ),
    ),
}));

import { WikiChangeBlock } from "../components/thread/wiki-change-block";

const change = (state: string) => ({ id: "c1", state, pages: [{ title: "Alpha Builders" }] });

let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.replaceChildren(host);
  get.mockReset();
  decide.mockReset();
  push.mockReset();
});
async function render(node: ReactNode) {
  const root = createRoot(host);
  await act(async () => root.render(node));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  return () => act(async () => root.unmount());
}
const card = () => host.querySelector<HTMLElement>("[data-state]");

it("shows the change as it stands now", async () => {
  get.mockResolvedValue(change("pending"));
  const unmount = await render(createElement(WikiChangeBlock, { changeId: "c1" }));
  expect(get).toHaveBeenCalledWith("c1");
  expect(card()?.dataset.state).toBe("pending");
  await unmount();
});

it("shows nothing for a change that cannot be read", async () => {
  get.mockRejectedValue(new Error("not found"));
  const unmount = await render(createElement(WikiChangeBlock, { changeId: "c1" }));
  expect(card()).toBeNull();
  await unmount();
});

it("sends the answer and shows the state it reaches", async () => {
  get.mockResolvedValue(change("pending"));
  decide.mockResolvedValue(change("applied"));
  const unmount = await render(createElement(WikiChangeBlock, { changeId: "c1" }));
  await act(async () => host.querySelectorAll("button")[0]!.click());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(decide).toHaveBeenCalledWith("c1", "apply");
  expect(card()?.dataset.state).toBe("applied");
  await unmount();
});

it("asks the server again when someone answered first", async () => {
  get.mockResolvedValueOnce(change("pending")).mockResolvedValue(change("refused"));
  decide.mockRejectedValue(new Error("conflict"));
  const unmount = await render(createElement(WikiChangeBlock, { changeId: "c1" }));
  await act(async () => host.querySelectorAll("button")[0]!.click());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(card()?.dataset.state).toBe("refused");
  await unmount();
});

it("opens a page in the Wiki", async () => {
  get.mockResolvedValue(change("applied"));
  const unmount = await render(createElement(WikiChangeBlock, { changeId: "c1" }));
  await act(async () => host.querySelectorAll("button")[1]!.click());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  expect(push).toHaveBeenCalledWith({
    pathname: "/wiki-page",
    params: { title: "Alpha Builders" },
  });
  await unmount();
});
