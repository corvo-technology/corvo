// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  usage: { usedTokens: 64_000, windowTokens: 128_000 } as {
    usedTokens: number | null;
    windowTokens: number | null;
  },
  compress: vi.fn(async (_input: { botId: string }) => ({ ok: true })),
}));

vi.mock("../../lib/query", () => ({
  useSpaceQueries: () => ({
    threads: {
      context: {
        queryOptions: ({ input }: { input: { botId: string } }) => ({
          queryKey: ["context", input.botId],
          queryFn: async () => data.usage,
        }),
      },
      compress: {
        mutationOptions: () => ({ mutationFn: data.compress }),
      },
    },
  }),
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    i18n: { locale: "en" },
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((text, part, i) => text + (i ? String(values[i - 1]) : "") + part, ""),
  }),
}));
vi.mock("@corvo/ui-web", () => ({
  Button: (props: ComponentProps<"button">) => <button type="button" {...props} />,
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../../components/IconTooltip", () => ({
  IconTooltip: ({ children }: { children: ReactNode }) => children,
}));

import { ContextMeter } from "./context-meter";

let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  data.usage = { usedTokens: 64_000, windowTokens: 128_000 };
  data.compress.mockClear();
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  vi.unstubAllGlobals();
});

async function render(running = false) {
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (isRunning: boolean) => (
    <QueryClientProvider client={client}>
      <ContextMeter botId="bot-1" running={isRunning} />
    </QueryClientProvider>
  );
  await act(async () => root.render(tree(running)));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  return {
    rerender: (isRunning: boolean) => act(async () => root.render(tree(isRunning))),
    unmount: () => act(async () => root.unmount()),
  };
}

const compressButton = () =>
  [...container.querySelectorAll("button")].find((b) =>
    /Compress|Compressing/.test(b.textContent ?? ""),
  );

it("shows how much of the window is used", async () => {
  const view = await render();
  expect(container.querySelector('[data-testid="context-summary"]')?.textContent).toBe(
    "50% used · 64K of 128K tokens",
  );
  await view.unmount();
});

it("shows only the size when the model's window is unknown", async () => {
  data.usage = { usedTokens: 5_000, windowTokens: null };
  const view = await render();
  expect(container.querySelector('[data-testid="context-summary"]')?.textContent).toBe("5K tokens");
  await view.unmount();
});

it("shows nothing before the bot has answered", async () => {
  data.usage = { usedTokens: null, windowTokens: null };
  const view = await render();
  expect(container.querySelector('[data-testid="context-meter"]')).toBeNull();
  await view.unmount();
});

it("asks to compress once, and offers it again after the next turn", async () => {
  const view = await render();
  await act(async () => compressButton()?.click());
  expect(data.compress.mock.calls[0]?.[0]).toEqual({ botId: "bot-1" });
  expect(compressButton()?.textContent).toBe("Compressing…");
  expect(compressButton()?.hasAttribute("disabled")).toBe(true);
  await view.rerender(true);
  await view.rerender(false);
  expect(compressButton()?.textContent).toBe("Compress context");
  await view.unmount();
});
