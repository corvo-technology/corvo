// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";

const browser = vi.hoisted(() => ({
  props: null as null | { title: string | null; onOpen: (t: string | null) => void; api: unknown },
}));
const wikiApi = vi.hoisted(() => ({ index: () => Promise.resolve([]) }));
vi.mock("./WikiBrowser", () => ({
  WikiBrowser: (props: {
    title: string | null;
    onOpen: (t: string | null) => void;
    api: unknown;
  }) => {
    browser.props = props;
    return <div data-testid="browser">{props.title ?? "none"}</div>;
  },
}));
vi.mock("./WindowChrome", () => ({ WindowChrome: () => null }));
vi.mock("../lib/space-rpc", () => ({ useSpaceRpc: () => ({ wiki: wikiApi }) }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { WikiPage } from "./WikiPage";

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  browser.props = null;
});

async function mount(entry: string) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[entry]}>
          <WikiPage />
          <Where />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  return { host, unmount: () => act(async () => root.unmount()) };
}

it("opens the page the address names, over the space's own wiki", async () => {
  const { host, unmount } = await mount("/app/wiki?page=Launch%20Plan");
  expect(host.querySelector('[data-testid="browser"]')?.textContent).toBe("Launch Plan");
  expect(browser.props?.api).toBe(wikiApi);
  expect(host.querySelector("h1")?.textContent).toBe("Wiki");
  await unmount();
});

it("puts the open page in the address, so it can be shared and survives a reload", async () => {
  const { host, unmount } = await mount("/app/wiki");
  expect(host.querySelector('[data-testid="browser"]')?.textContent).toBe("none");
  await act(async () => browser.props?.onOpen("Ana Souza"));
  expect(host.querySelector('[data-testid="where"]')?.textContent).toBe("/app/wiki?page=Ana+Souza");
  await act(async () => browser.props?.onOpen(null));
  expect(host.querySelector('[data-testid="where"]')?.textContent).toBe("/app/wiki");
  await unmount();
});
