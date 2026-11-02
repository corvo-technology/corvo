// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";

const takeInitialBootstrap = vi.hoisted(() => vi.fn());
const footer = vi.hoisted(() => vi.fn());
const embedded = vi.hoisted(() => ({ value: false }));
vi.mock("../lib/embed", () => ({ isEmbedded: () => embedded.value }));
vi.mock("../lib/bootstrap", () => ({ takeInitialBootstrap }));
vi.mock("../lib/auth", () => ({
  authClient: { useSession: () => ({ data: { user: { name: "Ada" } } }) },
}));
vi.mock("../lib/query", () => ({
  useSpaceQueries: () => ({
    bootstrap: { queryOptions: () => ({ queryKey: ["bootstrap"] }) },
    usage: {
      subscriptions: {
        queryOptions: () => ({ queryKey: ["subscriptions"], queryFn: async () => [] }),
      },
    },
  }),
}));
vi.mock("../pages/shell/shell-sidebar", () => ({
  ShellSidebarFooter: (props: { navLinks: unknown[] }) => {
    footer(props.navLinks);
    return null;
  },
}));
vi.mock("../pages/WindowChrome", () => ({ WindowChrome: () => null }));
vi.mock("./IconTooltip", () => ({
  IconTooltip: ({ children }: { children: ReactElement }) => children,
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { AppRail } from "./AppRail";

let queryClient: QueryClient;
beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  takeInitialBootstrap.mockReset();
  footer.mockReset();
  embedded.value = false;
});

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

async function openMore(container: HTMLElement) {
  const more = container.querySelector('nav button[aria-label="More"]') as HTMLButtonElement;
  await act(async () => more.click());
  return [
    ...document.querySelectorAll('[role="dialog"] button, [data-slot="popover-content"] button'),
  ]
    .map((button) => button.textContent)
    .filter(Boolean);
}

async function renderRail() {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/app"]}>
          <AppRail ticketBoardEnabled={false} />
          <Where />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  return {
    container,
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

it("never takes the first bootstrap, which the agents screen needs for itself", async () => {
  const { cleanup } = await renderRail();
  expect(takeInitialBootstrap).not.toHaveBeenCalled();
  await cleanup();
});

it("shows the links a screen beside it has already loaded", async () => {
  queryClient.setQueryData(["bootstrap"], { me: { navLinks: [{ id: "docs", label: "Docs" }] } });
  const { cleanup } = await renderRail();
  expect(footer).toHaveBeenLastCalledWith([{ id: "docs", label: "Docs" }]);
  await cleanup();
});

it("keeps three areas in sight and the rest behind three dots", async () => {
  const { container, cleanup } = await renderRail();
  const buttons = [...container.querySelectorAll("nav button")];
  expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
    "Agents",
    "Routines",
    "Workflows",
    "More",
    "Store",
  ]);
  expect(buttons[0]?.getAttribute("aria-current")).toBe("page");
  expect(buttons[3]?.getAttribute("aria-current")).toBeNull();
  await cleanup();
});

it("lists Usage, Artifacts, Approvals and Memory behind the dots, and goes where one points", async () => {
  const { container, cleanup } = await renderRail();
  expect(await openMore(container)).toEqual(["Usage", "Artifacts", "Approvals", "Memory"]);
  const approvals = [...document.querySelectorAll("button")].find(
    (button) => button.textContent === "Approvals",
  ) as HTMLButtonElement;
  await act(async () => approvals.click());
  expect(container.querySelector('[data-testid="where"]')?.textContent).toBe(
    "/app?settings=confirmations",
  );
  await cleanup();
});

it("keeps only the places that are not account settings inside a partner's frame", async () => {
  embedded.value = true;
  const { container, cleanup } = await renderRail();
  expect(await openMore(container)).toEqual(["Usage", "Artifacts"]);
  expect(footer).not.toHaveBeenCalled();
  await cleanup();
});

it("leaves out what a partner hides from its customers, never the agents", async () => {
  queryClient.setQueryData(["bootstrap"], {
    me: { partner: { name: "Acme", hide: ["usage", "store"] } },
  });
  const { container, cleanup } = await renderRail();
  const buttons = [...container.querySelectorAll("nav button")];
  expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
    "Agents",
    "Routines",
    "Workflows",
    "More",
  ]);
  expect(await openMore(container)).toEqual(["Artifacts", "Approvals", "Memory"]);
  await cleanup();
});
