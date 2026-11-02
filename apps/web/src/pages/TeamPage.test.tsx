// @vitest-environment jsdom
import type { SpaceBot, SpaceGroup } from "@corvo/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray) => parts.join("");
  return {
    useLingui: () => ({ t, i18n: { locale: "en" } }),
    Trans: ({ children }: { children: ReactNode }) => children,
  };
});
vi.mock("@corvo/ui-web", () => ({
  BotAvatar: () => <span />,
  Spinner: (props: ComponentProps<"svg">) => <svg role="status" {...props} />,
  Button: (props: ComponentProps<"button">) => <button type="button" {...props} />,
}));
vi.mock("./WindowChrome", () => ({ WindowChrome: () => null }));
vi.mock("../lib/query", () => ({
  useSpaceQueries: () => ({ bootstrap: { queryKey: () => ["bootstrap"] } }),
}));
const bots = [
  {
    id: "a",
    name: "Ops",
    color: "#111",
    status: "running",
    preview: "Checking logs",
    parentBotId: null,
  },
  { id: "b", name: "Dev", color: "#222", status: "idle", preview: "", parentBotId: null },
  { id: "c", name: "Solo", color: "#333", status: "idle", preview: "", parentBotId: null },
] as SpaceBot[];
const groups = [
  {
    id: "g1",
    name: "Engineering",
    members: [
      { botId: "a", name: "Ops", color: "#111" },
      { botId: "b", name: "Dev", color: "#222" },
    ],
  },
] as SpaceGroup[];
vi.mock("../lib/bootstrap", () => ({
  takeInitialBootstrap: () => Promise.resolve({ bots, groups }),
}));

import { TeamPage } from "./TeamPage";

it("shows each team with who is working, and bots outside any team", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <TeamPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  for (let i = 0; i < 10 && !container.querySelector('[data-testid="team-g1"]'); i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
  expect(container.querySelector('[data-testid="team-g1"]')?.textContent).toContain("Engineering");
  expect(container.querySelector('[data-testid="member-a"]')?.getAttribute("data-state")).toBe(
    "working",
  );
  expect(container.querySelector('[data-testid="member-b"]')?.getAttribute("data-state")).toBe(
    "idle",
  );
  expect(container.querySelector('[data-testid="team-unassigned"]')?.textContent).toContain("Solo");
  await act(async () => root.unmount());
});
