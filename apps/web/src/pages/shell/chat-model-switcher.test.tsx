// @vitest-environment jsdom
import type { Bot } from "@corvo/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";
import { ChatModelSwitcher } from "./chat-model-switcher";

const data = vi.hoisted(() => ({
  credentials: [] as unknown[],
  catalog: [] as unknown[],
  partner: null as { models: "fixed" | "choose" } | null,
}));
const picker = vi.hoisted(() => vi.fn());

vi.mock("../../lib/query", () => ({
  useSpaceQueries: () => ({
    models: {
      credentials: {
        queryOptions: () => ({ queryKey: ["credentials"], queryFn: async () => data.credentials }),
      },
      list: {
        queryOptions: () => ({ queryKey: ["catalog"], queryFn: async () => data.catalog }),
      },
    },
    me: {
      queryOptions: () => ({
        queryKey: ["me"],
        queryFn: async () => ({
          defaultProvider: "openai",
          defaultModel: "gpt-x",
          partner: data.partner,
        }),
      }),
    },
  }),
}));
vi.mock("./chat-model-picker", () => ({
  ChatModelPicker: (props: unknown) => {
    picker(props);
    return null;
  },
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((text, part, i) => text + (i ? String(values[i - 1]) : "") + part, ""),
  }),
}));

const bot = (overrides: Partial<Bot> = {}) =>
  ({ id: "bot-1", modelProvider: null, modelId: null, ...overrides }) as Bot;

async function mount(current: Bot, onChange = vi.fn().mockResolvedValue(undefined)) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = (children: ReactNode) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  await act(async () => root.render(wrap(<ChatModelSwitcher bot={current} onChange={onChange} />)));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
  return { onChange, unmount: () => act(async () => root.unmount()) };
}

const lastProps = () =>
  picker.mock.lastCall?.[0] as {
    choices: { key: string }[];
    value: string;
    chip: boolean;
    onChange: (key: string) => void;
  };

beforeEach(() => {
  picker.mockReset();
  data.partner = null;
  data.credentials = [{ provider: "openai", modelId: null, enabledModelIds: [] }];
  data.catalog = [
    { provider: "openai", id: "gpt-x", label: "GPT X" },
    { provider: "openai", id: "gpt-y", label: "GPT Y" },
  ];
});

it("offers the space default and the connected models, with the bot's own model selected", async () => {
  const { unmount } = await mount(bot({ modelProvider: "openai", modelId: "gpt-y" }));
  expect(lastProps().chip).toBe(true);
  expect(lastProps().value).toBe("openai::gpt-y");
  expect(lastProps().choices.map((choice) => choice.key)).toEqual([
    "",
    "openai::gpt-x",
    "openai::gpt-y",
  ]);
  await unmount();
});

it("saves the chosen model and resets the thinking level", async () => {
  const { onChange, unmount } = await mount(bot());
  await act(async () => lastProps().onChange("openai::gpt-x"));
  expect(onChange).toHaveBeenCalledWith({
    modelProvider: "openai",
    modelId: "gpt-x",
    thinkingLevel: null,
  });
  await unmount();
});

it("is not shown when no model is connected to switch to", async () => {
  data.credentials = [];
  data.catalog = [];
  const { unmount } = await mount(bot());
  expect(picker).not.toHaveBeenCalled();
  await unmount();
});

it("is not shown to a partner's customer whose partner fixes the model, but is when it lets them choose", async () => {
  data.partner = { models: "fixed" };
  const fixed = await mount(bot());
  expect(picker).not.toHaveBeenCalled();
  await fixed.unmount();
  data.partner = { models: "choose" };
  const free = await mount(bot());
  expect(picker).toHaveBeenCalled();
  await free.unmount();
});
