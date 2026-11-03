// @vitest-environment jsdom
import type { McpServer } from "@corvo/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { AppAgentAccess } from "./AppAgentAccess";

const access = vi.hoisted(() => ({ all: vi.fn(), replace: vi.fn(), bots: vi.fn() }));
const api = vi.hoisted(() => ({
  mcp: { assignments: { all: access.all, replace: access.replace } },
  bots: { list: access.bots },
}));
vi.mock("../lib/rpc", () => ({
  rpc: api,
  rpcForSpace: () => api,
  createSpaceRpc: () => api,
  selectedSpaceId: () => null,
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((text, part, i) => text + (i ? String(values[i - 1]) : "") + part, ""),
  }),
}));
vi.mock("@corvo/ui-web", async () => {
  const { createElement } = await import("react");
  return {
    Button: ({
      children,
      onClick,
      disabled,
      "aria-pressed": pressed,
    }: {
      children: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
      "aria-pressed"?: boolean;
    }) => createElement("button", { onClick, disabled, "aria-pressed": pressed }, children),
  };
});

const trello = { id: "srv_trello", name: "Trello" } as McpServer;
const grant = (botId: string, serverId: string) => ({
  botId,
  serverId,
  allowAllTools: true,
  allowedTools: [],
});
let client: QueryClient;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  access.bots.mockReset().mockResolvedValue([
    { id: "bot_1", name: "Chief" },
    { id: "bot_2", name: "Analyst" },
    { id: "bot_3", name: "Old", archivedAt: "2026-01-01" },
  ]);
  access.all.mockReset().mockResolvedValue([grant("bot_1", "srv_trello"), grant("bot_2", "srv_x")]);
  access.replace.mockReset().mockResolvedValue([]);
});

async function mount() {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <AppAgentAccess server={trello} />
      </QueryClientProvider>,
    ),
  );
  await vi.waitFor(() => expect(host.textContent).toContain("Analyst"));
  return { host, unmount: () => act(async () => root.unmount()) };
}

const chip = (host: HTMLElement, name: string) =>
  Array.from(host.querySelectorAll("button")).find(
    (item) => item.textContent === name,
  ) as HTMLButtonElement;

it("shows each active agent and marks the ones that can use the app", async () => {
  const { host, unmount } = await mount();
  await vi.waitFor(() => expect(chip(host, "Chief").getAttribute("aria-pressed")).toBe("true"));
  expect(chip(host, "Analyst").getAttribute("aria-pressed")).toBe("false");
  expect(host.textContent).not.toContain("Old");
  await unmount();
});

it("gives an agent the app on top of what it already has", async () => {
  access.all.mockResolvedValue([grant("bot_2", "srv_x")]);
  const { host, unmount } = await mount();
  await vi.waitFor(() => expect(chip(host, "Analyst").disabled).toBe(false));
  await act(async () => chip(host, "Analyst").click());
  expect(access.replace).toHaveBeenCalledWith({
    botId: "bot_2",
    assignments: [
      grant("bot_2", "srv_x"),
      { serverId: "srv_trello", allowAllTools: true, allowedTools: [] },
    ],
  });
  await unmount();
});

it("takes the app away from an agent without touching its other apps", async () => {
  access.all.mockResolvedValue([grant("bot_1", "srv_trello"), grant("bot_1", "srv_x")]);
  const { host, unmount } = await mount();
  await vi.waitFor(() => expect(chip(host, "Chief").disabled).toBe(false));
  await act(async () => chip(host, "Chief").click());
  expect(access.replace).toHaveBeenCalledWith({
    botId: "bot_1",
    assignments: [grant("bot_1", "srv_x")],
  });
  await unmount();
});

it("shows nothing when there are no agents", async () => {
  access.bots.mockResolvedValue([]);
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <AppAgentAccess server={trello} />
      </QueryClientProvider>,
    ),
  );
  await vi.waitFor(() => expect(access.bots).toHaveBeenCalled());
  expect(host.textContent).toBe("");
  await act(async () => root.unmount());
});
