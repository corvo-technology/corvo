// @vitest-environment jsdom
import type { SpaceBot, SpaceGroup } from "@corvo/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => text + part + (values[index] ?? ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((text, part, index) => text + part + (values[index] ?? ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@corvo/ui-web", () => ({
  BotAvatar: ({ status }: { status?: string }) => <span data-avatar-status={status} />,
  Button: (props: ComponentProps<"button">) => <button type="button" {...props} />,
}));

import { buildTeamRoster } from "../lib/team-roster";
import { TeamBoard } from "./TeamBoard";

const NOW = Date.now();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const bot = (id: string, status = "idle", extra: Partial<SpaceBot> = {}) =>
  ({
    id,
    name: id,
    title: "",
    color: "#111",
    status,
    preview: "Stopped. This was still waiting for…",
    parentBotId: null,
    updatedAt: ago(2 * 60 * 60 * 1000),
    ...extra,
  }) as SpaceBot;
const group = (id: string, botIds: string[], purpose: string | null = null) =>
  ({
    id,
    name: id,
    purpose,
    members: botIds.map((botId) => ({ botId, name: botId, color: "#111" })),
  }) as SpaceGroup;

const onOpen = vi.fn();
beforeEach(() => {
  onOpen.mockReset();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

async function mount(bots: SpaceBot[], groups: SpaceGroup[]) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(<TeamBoard roster={buildTeamRoster(bots, groups)} onOpen={onOpen} />),
  );
  return { host, unmount: () => act(async () => root.unmount()) };
}
const q = (host: HTMLElement, id: string) =>
  host.querySelector<HTMLElement>(`[data-testid="${id}"]`) as HTMLElement;

it("shows a team with what it is for, how many are in it and how many are working", async () => {
  const { host, unmount } = await mount(
    [bot("a", "running"), bot("b"), bot("c")],
    [group("eng", ["a", "b", "c"], "Analyzes product and watches operations")],
  );
  const team = q(host, "team-eng");
  expect(team.textContent).toContain("Analyzes product and watches operations");
  expect(team.textContent).toContain("3 agents");
  expect(team.textContent).toContain("1 working");
  await unmount();
});

it("does not count a single agent, which the one row already says", async () => {
  const { host, unmount } = await mount([bot("a"), bot("solo")], [group("eng", ["a", "a"])]);
  expect(q(host, "team-unassigned").textContent).not.toContain("1 agents");
  expect(q(host, "team-unassigned").textContent).not.toContain("agents");
  await unmount();
});

it("says what each agent is doing, not what it last wrote", async () => {
  const { host, unmount } = await mount(
    [bot("run", "running"), bot("ask", "waiting_input"), bot("err", "failed"), bot("rest")],
    [group("eng", ["run", "ask", "err", "rest"])],
  );
  expect(q(host, "member-run").textContent).toContain("Working…");
  expect(q(host, "member-ask").textContent).toContain("Needs an answer");
  expect(q(host, "member-err").textContent).toContain("Error");
  // At rest it is when it last was, not the text of its last message.
  expect(q(host, "member-rest").textContent).toContain("2h ago");
  expect(host.textContent).not.toContain("Stopped. This was still waiting for");
  await unmount();
});

it("marks who is working and who needs you, and shows those first", async () => {
  const { host, unmount } = await mount(
    [bot("rest"), bot("run", "running"), bot("ask", "waiting_input")],
    [group("eng", ["rest", "run", "ask"])],
  );
  expect(q(host, "member-run").getAttribute("data-state")).toBe("working");
  expect(q(host, "member-ask").getAttribute("data-state")).toBe("needs-you");
  expect(q(host, "member-rest").getAttribute("data-state")).toBe("idle");
  const order = [...host.querySelectorAll('[data-testid^="member-"]')].map((item) =>
    item.getAttribute("data-testid"),
  );
  expect(order).toEqual(["member-ask", "member-run", "member-rest"]);
  await unmount();
});

it("shows the role of an agent that has one", async () => {
  const { host, unmount } = await mount(
    [bot("a", "idle", { title: "Reviews pull requests" }), bot("b")],
    [group("eng", ["a", "b"])],
  );
  expect(q(host, "member-a").textContent).toContain("Reviews pull requests");
  await unmount();
});

it("puts the Chief on top, once, and not among those with no team", async () => {
  const { host, unmount } = await mount(
    [bot("chief", "running", { spawnKey: "onboarding:first" }), bot("solo"), bot("a")],
    [group("eng", ["a"])],
  );
  expect(q(host, "team-chief").textContent).toContain("chief");
  expect(q(host, "team-chief").textContent).toContain("Working…");
  const unassigned = q(host, "team-unassigned");
  expect(unassigned.textContent).toContain("solo");
  expect(unassigned.textContent).not.toContain("chief");
  expect(unassigned.textContent).toContain("Not in a team");
  await unmount();
});

it("does not show a team nobody is in, nor a list of agents with no team when there are none", async () => {
  const { host, unmount } = await mount(
    [bot("a")],
    [group("empty", ["gone"]), group("eng", ["a"])],
  );
  expect(host.querySelector('[data-testid="team-empty"]')).toBeNull();
  expect(host.querySelector('[data-testid="team-unassigned"]')).toBeNull();
  await unmount();
});

it("opens the team's squad from its heading, and an agent's chat from its row", async () => {
  const { host, unmount } = await mount([bot("a"), bot("b")], [group("eng", ["a", "b"])]);
  await act(async () => q(host, "team-eng").querySelector("button")?.click());
  expect(onOpen).toHaveBeenLastCalledWith("/app/g/eng/squad");
  await act(async () => q(host, "member-b").click());
  expect(onOpen).toHaveBeenLastCalledWith("/app/b");
  await unmount();
});

it("gives the avatar the agent's real status, so a failure looks like one", async () => {
  const { host, unmount } = await mount([bot("e", "failed"), bot("r")], [group("eng", ["e", "r"])]);
  expect(
    q(host, "member-e").querySelector("[data-avatar-status]")?.getAttribute("data-avatar-status"),
  ).toBe("failed");
  await unmount();
});
