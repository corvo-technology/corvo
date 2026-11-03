// @vitest-environment jsdom
import type { MessageBlock } from "@corvo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PlanCard } from "./PlanCard";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((text, part, i) => text + (i ? String(values[i - 1]) : "") + part, ""),
  }),
}));

const block: Extract<MessageBlock, { kind: "plan" }> = {
  kind: "plan",
  title: "Bio for CorvoBots",
  steps: [
    { id: "1", label: "Write five versions", owner: "Content writer", status: "done" },
    { id: "2", label: "Review the tone", status: "running", note: "Waiting for Brand" },
    { id: "3", label: "Publish", status: "pending" },
    { id: "4", label: "Send to Instagram", status: "failed", note: "No access" },
  ],
};

it("shows the title and every step with its owner, note and a status a screen reader can name", async () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => root.render(<PlanCard block={block} />));
  expect(host.textContent).toContain("Bio for CorvoBots");
  const steps = Array.from(host.querySelectorAll('[data-testid="plan-step"]'));
  expect(steps.map((step) => step.getAttribute("data-status"))).toEqual([
    "done",
    "running",
    "pending",
    "failed",
  ]);
  expect(steps[0]?.textContent).toContain("Content writer");
  expect(steps[1]?.textContent).toContain("Waiting for Brand");
  expect(steps.map((step) => step.querySelector("[role=img]")?.getAttribute("aria-label"))).toEqual(
    ["Done", "In progress", "Waiting", "Failed"],
  );
  await act(async () => root.unmount());
});
