// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { StoreInstalledApps } from "./StoreInstalledApps";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@corvo/ui-web", async () => {
  const { createElement } = await import("react");
  return {
    Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) =>
      createElement("button", { onClick }, children),
  };
});

const notion = {
  id: "s1",
  slug: "notion",
  name: "Notion",
  enabled: true,
  oauthStatus: "connected",
};
const custom = { id: "s2", slug: "otto", name: "otto", enabled: true, oauthStatus: "none" };

async function mount(
  servers: unknown[],
  extra: {
    chatApps?: Array<{ provider: string; label: string }>;
    onOpenChat?: (provider: string) => void;
    onManage?: () => void;
  } = {},
  onOpen = vi.fn(),
) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(<StoreInstalledApps servers={servers as never} onOpen={onOpen} {...extra} />),
  );
  return { host, unmount: () => act(async () => root.unmount()) };
}

it("shows nothing until an app has been added", async () => {
  const { host, unmount } = await mount([]);
  expect(host.querySelector('[data-testid="store-installed-apps"]')).toBeNull();
  await unmount();
});

it("lists the added apps, with the catalog's icon when there is one", async () => {
  const { host, unmount } = await mount([notion, custom]);
  const names = Array.from(host.querySelectorAll("button")).map((button) => button.textContent);
  expect(names).toEqual(["Notion", "otto"]);
  const buttons = host.querySelectorAll("button");
  expect(buttons[0]?.querySelector("img")).not.toBeNull();
  expect(buttons[1]?.querySelector("img")).toBeNull();
  await unmount();
});

it("opens the app that was chosen", async () => {
  const onOpen = vi.fn();
  const { host, unmount } = await mount([notion, custom], {}, onOpen);
  await act(async () => (host.querySelectorAll("button")[1] as HTMLButtonElement).click());
  expect(onOpen).toHaveBeenCalledWith(custom);
  await unmount();
});

it("lists connected chat apps with the others and opens the one chosen", async () => {
  const onOpenChat = vi.fn();
  const { host, unmount } = await mount([notion], {
    chatApps: [{ provider: "telegram", label: "Telegram" }],
    onOpenChat,
  });
  const names = Array.from(host.querySelectorAll("button")).map((button) => button.textContent);
  expect(names).toEqual(["Telegram", "Notion"]);
  await act(async () => (host.querySelectorAll("button")[0] as HTMLButtonElement).click());
  expect(onOpenChat).toHaveBeenCalledWith("telegram");
  await unmount();
});

it("shows a chat app on its own when no server has been added", async () => {
  const { host, unmount } = await mount([], {
    chatApps: [{ provider: "telegram", label: "Telegram" }],
  });
  expect(host.querySelector('[data-testid="store-installed-apps"]')).not.toBeNull();
  await unmount();
});

it("flags an app that needs attention and stays quiet about the healthy ones", async () => {
  const { host, unmount } = await mount([
    { ...notion, enabled: true, oauthStatus: "connected" },
    { ...custom, enabled: true, oauthStatus: "reconnect" },
    { id: "s3", slug: "x", name: "Off", enabled: false, oauthStatus: "none" },
  ]);
  const text = (i: number) => host.querySelectorAll("button")[i]?.textContent;
  expect(text(0)).toBe("Notion");
  expect(text(1)).toBe("ottoOAuth expired");
  expect(text(2)).toBe("OffDisabled");
  await unmount();
});

it("offers to manage the MCP servers only when it can", async () => {
  const onManage = vi.fn();
  const withManage = await mount([notion], { onManage });
  const manage = Array.from(withManage.host.querySelectorAll("button")).find(
    (button) => button.textContent === "Manage MCP servers",
  );
  await act(async () => manage?.click());
  expect(onManage).toHaveBeenCalled();
  await withManage.unmount();
  const without = await mount([notion]);
  expect(without.host.textContent).not.toContain("Manage MCP servers");
  await without.unmount();
});
