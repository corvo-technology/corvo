// @vitest-environment jsdom

import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatStarters } from "./chat-starters";

let root: Root;
let container: HTMLDivElement;

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

describe("ChatStarters", () => {
  it("shows one button per starter and sends the one that is tapped", async () => {
    const onPick = vi.fn();
    await act(async () =>
      root.render(
        <ChatStarters starters={["Show today's bookings", "Who has not paid?"]} onPick={onPick} />,
      ),
    );
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Show today's bookings",
      "Who has not paid?",
    ]);
    await act(async () => buttons[1]?.click());
    expect(onPick).toHaveBeenCalledWith("Who has not paid?");
  });

  it("shows nothing when there are no starters", async () => {
    await act(async () => root.render(<ChatStarters starters={[]} onPick={vi.fn()} />));
    expect(container.querySelector("button")).toBeNull();
  });
});
