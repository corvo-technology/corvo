// @vitest-environment jsdom

import type { RoutineRun } from "@corvo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join(""), i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../lib/query", () => ({ useSpaceQueries: () => ({}) }));
vi.mock("../lib/run-error", () => ({ translateRunError: (message: string) => message }));

import { RunSummary } from "./RoutineRunDetail";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const run = (over: Partial<RoutineRun>): RoutineRun => ({
  id: "run-1",
  botId: "b1",
  groupId: null,
  status: "completed",
  error: null,
  createdAt: "2026-10-30T12:00:00.000Z",
  startedAt: "2026-10-30T12:00:00.000Z",
  completedAt: "2026-10-30T12:00:42.000Z",
  messageId: null,
  ...over,
});

async function render(value: RoutineRun) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<RunSummary run={value} />));
  return {
    container,
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

it("says how long a finished run took", async () => {
  const { container, cleanup } = await render(run({}));
  expect(container.textContent).toContain("Took 42 sec");
  expect(container.textContent).not.toContain("Details");
  await cleanup();
});

it("says why a failed run stopped, and keeps the raw error one click away", async () => {
  const { container, cleanup } = await render(
    run({ status: "failed", error: "The Gmail connection expired" }),
  );
  expect(container.textContent).toContain("The Gmail connection expired");
  expect(container.querySelector("details")).not.toBeNull();
  await cleanup();
});

it("says nothing about the time of a run that has not finished", async () => {
  const { container, cleanup } = await render(run({ status: "running", completedAt: null }));
  expect(container.textContent).not.toContain("Took");
  await cleanup();
});
