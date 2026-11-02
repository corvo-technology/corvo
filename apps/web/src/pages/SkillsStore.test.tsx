// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { SkillsStore } from "./SkillsStore";

const locale = vi.hoisted(() => ({ current: "en" }));
const installed = vi.hoisted(() => ({ current: [] as Array<{ name: string }> }));
const install = vi.hoisted(() => vi.fn());

vi.mock("../lib/skill-store-install", async () => {
  const actual = await vi.importActual<typeof import("../lib/skill-store-install")>(
    "../lib/skill-store-install",
  );
  return { ...actual, installStoreSkill: install };
});
vi.mock("../lib/query", () => ({
  useSpaceQueries: () => ({
    agentSkills: {
      list: {
        queryOptions: () => ({ queryKey: ["skills"], queryFn: async () => installed.current }),
      },
    },
  }),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({
    i18n: { locale: locale.current },
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

beforeEach(() => {
  locale.current = "en";
  installed.current = [];
  install.mockReset().mockResolvedValue(undefined);
});

async function mount(query = "") {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <SkillsStore query={query} />
      </QueryClientProvider>,
    ),
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  return { host, unmount: () => act(async () => root.unmount()) };
}

const card = (host: HTMLElement, slug: string) =>
  host.querySelector(`[data-testid="skill-card-${slug}"]`) as HTMLElement;
const button = (scope: HTMLElement, text: string) =>
  Array.from(scope.querySelectorAll("button")).find((item) => item.textContent === text);

it("lists the skills in English, and in Portuguese for a Portuguese app", async () => {
  const english = await mount();
  expect(card(english.host, "project-plan").textContent).toContain("Project Plan");
  await english.unmount();
  locale.current = "pt-BR";
  const portuguese = await mount();
  expect(card(portuguese.host, "project-plan").textContent).toContain("Plano de projeto");
  await portuguese.unmount();
});

it("installs a skill in the language shown", async () => {
  const { host, unmount } = await mount();
  await act(async () => button(card(host, "project-plan"), "Install")?.click());
  expect(install).toHaveBeenCalledWith(expect.objectContaining({ slug: "project-plan" }), "en");
  await unmount();
});

it("shows an installed skill as Installed, whichever language it was installed in", async () => {
  installed.current = [{ name: "Plano de projeto" }];
  const { host, unmount } = await mount();
  const scope = card(host, "project-plan");
  expect(button(scope, "Install")).toBeUndefined();
  expect(scope.textContent).toContain("Installed");
  await unmount();
});

it("filters by what the person searches for", async () => {
  const { host, unmount } = await mount("email");
  expect(card(host, "email-reply")).toBeTruthy();
  expect(card(host, "project-plan")).toBeNull();
  await unmount();
});

it("filters the skills by category", async () => {
  const { host, unmount } = await mount();
  const chip = (label: string) =>
    Array.from(host.querySelectorAll('[data-testid="store-categories"] button')).find(
      (item) => item.textContent === label,
    ) as HTMLButtonElement;
  await act(async () => chip("Finance").click());
  expect(card(host, "cash-flow-forecast")).toBeTruthy();
  expect(card(host, "design-critique")).toBeNull();
  await act(async () => chip("All").click());
  expect(card(host, "design-critique")).toBeTruthy();
  await unmount();
});
