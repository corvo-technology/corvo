// @vitest-environment jsdom

import type { MessageBlock } from "@corvo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  const element =
    (tag: string) =>
    ({ children }: { children?: ReactNode }) =>
      createElement(tag, {}, children);
  return {
    Alert: { alert: vi.fn() },
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: element("span"),
    View: element("div"),
  };
});
vi.mock("./api", () => ({ rpc: api.rpc }));
vi.mock("./i18n", () => ({
  useI18n: () => ({
    t: (text: string, values: Record<string, string> = {}) =>
      text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? ""),
  }),
}));
vi.mock("./native", () => ({
  native: { fill: "fill", fillPressed: "fill-pressed" },
  useMobileTokens: () => ({}),
}));
vi.mock("./thread-read-only", () => ({ useThreadReadOnly: () => false }));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button type="button" onClick={onPress}>
      {label}
    </button>
  ),
}));

import { McpApprovalCard } from "../components/McpApprovalCard";

type Block = Extract<MessageBlock, { kind: "mcp_approval" }>;
const forSelf: Block = {
  kind: "mcp_approval",
  name: "Sentry",
  serverId: "srv_1",
  transport: "streamable_http",
  endpoint: "https://mcp.sentry.dev/mcp",
  needsOAuth: false,
  status: "pending",
};
const forTeammate: Block = {
  ...forSelf,
  forBotId: "bot_infra",
  forBotName: "Infraestrutura e SRE",
};

beforeEach(() => api.rpc.mockReset().mockResolvedValue({}));

async function mount(block: Block) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  await act(async () =>
    root.render(<McpApprovalCard botId="bot_chief" threadId="thread_1" block={block} />),
  );
  return { host, unmount: () => act(async () => root.unmount()) };
}

const press = (host: HTMLElement, label: string) =>
  act(async () =>
    Array.from(host.querySelectorAll("button"))
      .find((item) => item.textContent === label)
      ?.click(),
  );

it("gives the server to the agent whose chat shows the card", async () => {
  const { host, unmount } = await mount(forSelf);
  expect(host.textContent).not.toContain("Access for");
  await press(host, "Approve");
  expect(api.rpc).toHaveBeenCalledWith("mcp/assignments/approve", {
    botId: "bot_chief",
    serverId: "srv_1",
    threadId: "thread_1",
  });
  await unmount();
});

it("says whom the access is for, and gives it to that teammate, not to the agent asking", async () => {
  const { host, unmount } = await mount(forTeammate);
  expect(host.textContent).toContain("Access for Infraestrutura e SRE");
  await press(host, "Approve");
  expect(api.rpc).toHaveBeenCalledWith("mcp/assignments/approve", {
    botId: "bot_infra",
    serverId: "srv_1",
    threadId: "thread_1",
  });
  await unmount();
});

it("dismisses the card for the teammate too", async () => {
  const { host, unmount } = await mount(forTeammate);
  await press(host, "Not now");
  expect(api.rpc).toHaveBeenCalledWith("mcp/assignments/dismiss", {
    botId: "bot_infra",
    serverId: "srv_1",
    threadId: "thread_1",
  });
  await unmount();
});
