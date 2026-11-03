// @vitest-environment jsdom
import type { McpServer } from "@corvo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { AppCatalogGrid } from "./AppCatalogGrid";

const connect = vi.hoisted(() => vi.fn());
const bridge = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("./AppAgentAccess", () => ({ AppAgentAccess: () => null }));
vi.mock("../lib/desktop", () => ({ desktopBridge: () => bridge.current }));
vi.mock("../lib/app-catalog-connect", () => ({
  connectCatalogApp: (...args: unknown[]) => connect(...args),
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
      "aria-label": label,
    }: {
      children: ReactNode;
      onClick?: (event: unknown) => void;
      disabled?: boolean;
      "aria-label"?: string;
    }) => createElement("button", { onClick, disabled, "aria-label": label }, children),
    Input: (props: Record<string, unknown>) => createElement("input", props),
  };
});

const onUsePrompt = vi.fn();
const onChanged = vi.fn();

beforeEach(() => {
  bridge.current = undefined;
  connect.mockReset().mockResolvedValue({ server: {}, oauth: "connected" });
  onUsePrompt.mockReset();
  onChanged.mockReset();
});

function added(slug: string, endpoint: string, oauthStatus: McpServer["oauthStatus"]) {
  return { id: `srv_${slug}`, slug, endpoint, oauthStatus } as McpServer;
}

async function mount(props: { query?: string; servers?: McpServer[]; withPrompts?: boolean } = {}) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <AppCatalogGrid
        query={props.query ?? ""}
        servers={props.servers ?? []}
        onUsePrompt={props.withPrompts === false ? undefined : onUsePrompt}
        onChanged={onChanged}
      />,
    ),
  );
  return { host, unmount: () => act(async () => root.unmount()) };
}

function button(host: HTMLElement, text: string, within?: Element | null) {
  return Array.from((within ?? host).querySelectorAll("button")).find(
    (item) => item.textContent === text,
  ) as HTMLButtonElement | undefined;
}

const tile = (host: HTMLElement, slug: string) =>
  host.querySelector(`[data-testid="app-tile-${slug}"]`);

const desktopWithBrowser = { oauth: { open: async () => undefined } };

it("renders featured apps first", async () => {
  const { host, unmount } = await mount();
  const slugs = Array.from(host.querySelectorAll('[data-testid^="app-tile-"]')).map((item) =>
    item.getAttribute("data-testid")?.replace("app-tile-", ""),
  );
  expect(slugs.slice(0, 5).sort()).toEqual(["linear", "notion", "sentry", "stripe", "supabase"]);
  await unmount();
});

it("leaves out apps that only sign in through the desktop app in a browser", async () => {
  const { host, unmount } = await mount();
  expect(tile(host, "canva")).toBeNull();
  expect(tile(host, "vercel")).toBeNull();
  expect(button(host, "Design")).toBeUndefined();
  await unmount();
});

it("offers them in the desktop app", async () => {
  bridge.current = desktopWithBrowser;
  const { host, unmount } = await mount();
  expect(tile(host, "canva")).not.toBeNull();
  expect(tile(host, "vercel")).not.toBeNull();
  await unmount();
});

it("filters the grid with a category chip", async () => {
  bridge.current = desktopWithBrowser;
  const { host, unmount } = await mount();
  await act(async () => button(host, "Design")?.click());
  expect(tile(host, "canva")).not.toBeNull();
  expect(tile(host, "linear")).toBeNull();
  await unmount();
});

it("adds an oauth app in one click and refreshes the list", async () => {
  const { host, unmount } = await mount();
  await act(async () => button(host, "Add", tile(host, "linear"))?.click());
  expect(connect).toHaveBeenCalledWith(expect.objectContaining({ slug: "linear" }), {
    existing: undefined,
  });
  expect(onChanged).toHaveBeenCalled();
  await unmount();
});

it("asks for the key and shows its docs link before adding a key app", async () => {
  const { host, unmount } = await mount();
  await act(async () => button(host, "Add", tile(host, "render"))?.click());
  expect(connect).not.toHaveBeenCalled();
  expect(host.querySelector('a[href^="https://dashboard.render.com"]')).not.toBeNull();
  const input = host.querySelector("input") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "rnd_1");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => button(host, "Add")?.click());
  expect(connect).toHaveBeenCalledWith(expect.objectContaining({ slug: "render" }), {
    key: "rnd_1",
    existing: undefined,
  });
  await unmount();
});

it("does not call connect for a blank key", async () => {
  const { host, unmount } = await mount();
  await act(async () => button(host, "Add", tile(host, "render"))?.click());
  await act(async () => button(host, "Add")?.click());
  expect(connect).not.toHaveBeenCalled();
  await unmount();
});

it("shows example prompts for an added app and sends the clicked one", async () => {
  const servers = [added("linear", "https://mcp.linear.app/mcp", "connected")];
  const { host, unmount } = await mount({ servers });
  expect(button(host, "Added", tile(host, "linear"))).toBeDefined();
  await act(async () => button(host, "Added", tile(host, "linear"))?.click());
  const prompt = button(host, "What is assigned to me this week?");
  expect(prompt).toBeDefined();
  await act(async () => prompt?.click());
  expect(onUsePrompt).toHaveBeenCalledWith("What is assigned to me this week?");
  await unmount();
});

it("hides example prompts when there is no bot to send them to", async () => {
  const servers = [added("linear", "https://mcp.linear.app/mcp", "connected")];
  const { host, unmount } = await mount({ servers, withPrompts: false });
  await act(async () => button(host, "Added", tile(host, "linear"))?.click());
  expect(button(host, "What is assigned to me this week?")).toBeUndefined();
  await unmount();
});

it("shows Added for a server added by hand with the same endpoint", async () => {
  const servers = [added("my-notion", "https://mcp.notion.com/mcp", "connected")];
  const { host, unmount } = await mount({ servers });
  expect(button(host, "Added", tile(host, "notion"))).toBeDefined();
  await unmount();
});

it("falls back to the initial when the icon fails to load", async () => {
  const { host, unmount } = await mount({ query: "linear" });
  const img = tile(host, "linear")?.querySelector("img") as HTMLImageElement;
  await act(async () => img.dispatchEvent(new Event("error")));
  expect(tile(host, "linear")?.querySelector("img")).toBeNull();
  expect(tile(host, "linear")?.textContent).toContain("L");
  await unmount();
});

it("offers Sign in for an added oauth app that is not signed in", async () => {
  const servers = [added("linear", "https://mcp.linear.app/mcp", "none")];
  const { host, unmount } = await mount({ servers });
  const signIn = button(host, "Sign in", tile(host, "linear"));
  expect(signIn).toBeDefined();
  await act(async () => signIn?.click());
  expect(connect).toHaveBeenCalledWith(
    expect.objectContaining({ slug: "linear" }),
    expect.objectContaining({ existing: servers[0] }),
  );
  await unmount();
});

it("renders no catalog chrome when the search has no match", async () => {
  const { host, unmount } = await mount({ query: "zzzz-no-such-app" });
  expect(host.querySelector('[data-testid="app-catalog"]')).toBeNull();
  expect(host.querySelectorAll("button")).toHaveLength(0);
  await unmount();
});
