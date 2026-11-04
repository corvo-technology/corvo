// @vitest-environment jsdom
import type { GroupMember } from "@corvo/contracts";
import type { ReactElement, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((text, part, index) => text + part + (values[index] ?? ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../../components/IconTooltip", () => ({
  IconTooltip: ({ children }: { children: ReactElement }) => children,
}));

import { ChannelHeader } from "./channel-header";

const member = (id: string): GroupMember => ({ botId: id, name: id, color: "#3B82F6" });

async function render(props: Partial<Parameters<typeof ChannelHeader>[0]> = {}) {
  const handlers = {
    onOpenNavigation: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenSquad: vi.fn(),
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  await act(async () =>
    root.render(
      <ChannelHeader
        name="checkout"
        purpose="Online store, payments and cart"
        members={[member("a"), member("b"), member("c"), member("d")]}
        {...handlers}
        {...props}
      />,
    ),
  );
  return { host, root, handlers };
}

it("shows the channel as a name behind a hash, with what it is for", async () => {
  const { host, root } = await render();
  expect(host.textContent).toContain("#");
  expect(host.textContent).toContain("checkout");
  expect(host.textContent).toContain("Online store, payments and cart");
  await act(async () => root.unmount());
});

it("shows the agents in it up top and how many there are", async () => {
  const { host, root } = await render();
  expect(host.textContent).toContain("4 agents");
  expect(host.querySelectorAll(".corvo-mascot-avatar")).toHaveLength(4);
  await act(async () => root.unmount());
});

it("shows at most five faces and still counts every agent", async () => {
  const many = ["a", "b", "c", "d", "e", "f", "g"].map(member);
  const { host, root } = await render({ members: many });
  expect(host.querySelectorAll(".corvo-mascot-avatar")).toHaveLength(5);
  expect(host.textContent).toContain("7 agents");
  await act(async () => root.unmount());
});

it("has no purpose line when the channel has none", async () => {
  const { host, root } = await render({ purpose: null });
  expect(host.textContent).not.toContain("Online store");
  await act(async () => root.unmount());
});

it("opens the channel's settings from its name, its agents and the plus, and the squad from its own button", async () => {
  const { host, root, handlers } = await render();
  const press = async (selector: string) =>
    act(async () => (host.querySelector(selector) as HTMLButtonElement).click());
  await press('[data-testid="bot-settings-trigger"]');
  await press('button[aria-label="4 agents"]');
  await press('button[aria-label="Add agents"]');
  expect(handlers.onOpenSettings).toHaveBeenCalledTimes(3);
  await press('button[aria-label="Squad"]');
  expect(handlers.onOpenSquad).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});

it("shows who is working in place of the count, and puts them first with the working ring", async () => {
  const members: GroupMember[] = [
    { ...member("a") },
    { ...member("b"), status: "idle" },
    { ...member("c"), status: "running" },
    { ...member("d"), status: "queued" },
  ];
  const { host, root } = await render({ members });
  const status = host.querySelector('[data-testid="channel-working"]');
  expect(status?.textContent).toBe("c +1 · Working…");
  expect(host.textContent).not.toContain("4 agents");
  const faces = [...host.querySelectorAll(".corvo-mascot-avatar")];
  expect(faces.map((face) => face.getAttribute("data-working"))).toEqual([
    "true",
    "true",
    "false",
    "false",
  ]);
  await act(async () => root.unmount());
});

it("goes back to the count once no one is working", async () => {
  const { host, root } = await render({
    members: [member("a"), { ...member("b"), status: "idle" }],
  });
  expect(host.querySelector('[data-testid="channel-working"]')).toBeNull();
  expect(host.textContent).toContain("2 agents");
  await act(async () => root.unmount());
});
