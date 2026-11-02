// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@corvo/ui-web", () => ({
  BotAvatar: ({ size }: { size: number }) => <i data-avatar={size} />,
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { ChatEmpty } from "./chat-empty";

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

const intro = { id: "bot-1", name: "Atendente", title: "Front desk", color: "green" };

describe("ChatEmpty", () => {
  it("introduces the agent with a large mascot, its name and its role, then its starters", async () => {
    const onPick = vi.fn();
    await act(async () =>
      root.render(<ChatEmpty intro={intro} starters={["Show today's bookings"]} onPick={onPick} />),
    );
    expect(container.querySelector("[data-avatar]")?.getAttribute("data-avatar")).toBe("72");
    expect(container.textContent).toContain("Atendente");
    expect(container.textContent).toContain("Front desk");
    await act(async () => container.querySelector("button")?.click());
    expect(onPick).toHaveBeenCalledWith("Show today's bookings");
  });

  it("leaves out the role when the agent has none, and the buttons when it has no starters", async () => {
    await act(async () =>
      root.render(<ChatEmpty intro={{ ...intro, title: "" }} starters={[]} onPick={vi.fn()} />),
    );
    expect(container.textContent).toBe("Atendente");
    expect(container.querySelector("button")).toBeNull();
  });
});
