// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { ChatAppsRow } from "./ChatAppsRow";

const status = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const linkStart = vi.hoisted(() => vi.fn());
const unlink = vi.hoisted(() => vi.fn());

vi.mock("../lib/rpc", () => ({
  rpc: {
    messaging: { link: { start: linkStart }, identities: { unlink } },
  },
}));
vi.mock("../lib/query", () => ({
  useSpaceQueries: () => ({
    messaging: {
      status: {
        queryOptions: () => ({
          queryKey: ["messaging-status"],
          queryFn: async () => status.current,
        }),
      },
    },
  }),
}));
vi.mock("@lingui/react/macro", () => ({
  Plural: () => null,
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
    }: {
      children: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => createElement("button", { onClick, disabled }, children),
  };
});

const open = vi.fn();

beforeEach(() => {
  linkStart.mockReset().mockResolvedValue({
    code: "ABCD-2345",
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  });
  unlink.mockReset().mockResolvedValue({ ok: true });
  open.mockReset();
  vi.stubGlobal("open", open);
  status.current = {
    enabled: true,
    providers: ["telegram", "slack"],
    addresses: { telegram: "@corvo_example_bot" },
    openSignup: false,
    identities: [],
  };
});

async function mount(
  props: { botId?: string; query?: string; only?: string; connectedInSidebar?: boolean } = {},
) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <ChatAppsRow
          botId={"botId" in props ? props.botId : "bot-1"}
          query={props.query ?? ""}
          only={props.only}
          connectedInSidebar={props.connectedInSidebar}
        />
      </QueryClientProvider>,
    ),
  );
  // Let the status query resolve and render.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  return { host, unmount: () => act(async () => root.unmount()) };
}

const button = (host: HTMLElement, text: string) =>
  Array.from(host.querySelectorAll("button")).find((item) => item.textContent === text);

it("opens Telegram with the code attached when Connect is pressed", async () => {
  const { host, unmount } = await mount();
  expect(host.querySelector('[data-testid="chat-app-slack"]')).toBeNull();
  await act(async () => button(host, "Connect")?.click());
  expect(linkStart).toHaveBeenCalledWith({ botId: "bot-1" });
  expect(open).toHaveBeenCalledWith(
    "https://t.me/corvo_example_bot?start=ABCD2345",
    "_blank",
    "noopener,noreferrer",
  );
  expect(host.querySelector('[data-testid="chat-app-code"]')?.textContent).toContain("ABCD-2345");
  await unmount();
});

it("falls back to the code alone while the bot's username is unknown", async () => {
  status.current = { ...status.current, addresses: {} };
  const { host, unmount } = await mount();
  await act(async () => button(host, "Connect")?.click());
  expect(open).not.toHaveBeenCalled();
  expect(button(host, "Open Telegram")).toBeUndefined();
  expect(host.querySelector('[data-testid="chat-app-code"]')?.textContent).toContain("ABCD-2345");
  await unmount();
});

it("uses the bot's username learned after the screen loaded", async () => {
  status.current = { ...status.current, addresses: {} };
  const { host, unmount } = await mount();
  status.current = { ...status.current, addresses: { telegram: "@corvo_example_bot" } };
  await act(async () => button(host, "Connect")?.click());
  expect(open).toHaveBeenCalledWith(
    "https://t.me/corvo_example_bot?start=ABCD2345",
    "_blank",
    "noopener,noreferrer",
  );
  await unmount();
});

it("shows Connected with Unlink once this bot is linked", async () => {
  status.current = {
    ...status.current,
    identities: [{ id: "mi-1", provider: "telegram", botId: "bot-1", address: "424242" }],
  };
  const { host, unmount } = await mount();
  expect(button(host, "Connect")).toBeUndefined();
  expect(host.textContent).toContain("Connected");
  await act(async () => button(host, "Unlink")?.click());
  expect(unlink).toHaveBeenCalledWith({ identityId: "mi-1" });
  await unmount();
});

it("shows nothing without a bot or when the search does not match", async () => {
  const withoutBot = await mount({ botId: undefined });
  expect(withoutBot.host.querySelector('[data-testid="chat-apps"]')).toBeNull();
  await withoutBot.unmount();
  const noMatch = await mount({ query: "linear" });
  expect(noMatch.host.querySelector('[data-testid="chat-apps"]')).toBeNull();
  await noMatch.unmount();
});

it("shows just the chat app it is asked for", async () => {
  status.current = { ...status.current, providers: ["telegram", "whatsapp"] };
  const { host, unmount } = await mount({ only: "whatsapp" });
  expect(host.querySelector('[data-testid="chat-app-telegram"]')).toBeNull();
  expect(host.querySelector('[data-testid="chat-app-whatsapp"]')).not.toBeNull();
  await unmount();
});

it("hides a connected chat app's row on wide screens when the side column lists it", async () => {
  status.current = {
    ...status.current,
    providers: ["telegram", "whatsapp"],
    identities: [{ id: "mi-1", provider: "telegram", botId: "bot-1", address: "424242" }],
  };
  const { host, unmount } = await mount({ connectedInSidebar: true });
  expect(host.querySelector('[data-testid="chat-app-telegram"]')?.className).toContain("md:hidden");
  expect(host.querySelector('[data-testid="chat-app-whatsapp"]')?.className ?? "").not.toContain(
    "md:hidden",
  );
  expect(host.querySelector('[data-testid="chat-apps"]')?.className).not.toContain("md:hidden");
  await unmount();
});

it("hides the whole block on wide screens once every chat app is connected", async () => {
  status.current = {
    ...status.current,
    providers: ["telegram"],
    identities: [{ id: "mi-1", provider: "telegram", botId: "bot-1", address: "424242" }],
  };
  const { host, unmount } = await mount({ connectedInSidebar: true });
  expect(host.querySelector('[data-testid="chat-apps"]')?.className).toContain("md:hidden");
  await unmount();
});
