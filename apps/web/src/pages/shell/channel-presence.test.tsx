// @vitest-environment jsdom
import type { GroupMember } from "@corvo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((text, part, index) => text + part + (values[index] ?? ""), ""),
  }),
}));

import { ChannelPresence } from "./channel-presence";

const member = (id: string): GroupMember => ({
  botId: id,
  name: id,
  color: "#3B82F6",
  status: "running",
});

async function render(members: GroupMember[]) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  await act(async () => root.render(<ChannelPresence members={members} />));
  return { host, root };
}

it("draws nothing while no one is working", async () => {
  const { host, root } = await render([]);
  expect(host.innerHTML).toBe("");
  await act(async () => root.unmount());
});

it("shows the faces of whoever is working, and names them for assistive technology", async () => {
  const { host, root } = await render([member("Leo"), member("Nina")]);
  expect(host.querySelectorAll(".corvo-mascot-avatar")).toHaveLength(2);
  expect(host.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe(
    "Leo, Nina: Working…",
  );
  expect(host.querySelector(".corvo-presence-dot")).not.toBeNull();
  await act(async () => root.unmount());
});

it("shows three faces and counts the rest", async () => {
  const { host, root } = await render(["a", "b", "c", "d", "e"].map(member));
  expect(host.querySelectorAll(".corvo-mascot-avatar")).toHaveLength(3);
  expect(host.textContent).toContain("+2");
  expect(host.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe(
    "a, b, c, d, e: Working…",
  );
  await act(async () => root.unmount());
});
