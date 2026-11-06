// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WhatsAppNumbers } from "./WhatsAppNumbers";

const numbers = vi.hoisted(() => ({
  current: { available: true, numbers: [] } as {
    available: boolean;
    numbers: Array<Record<string, unknown>>;
  },
}));
const linkStatus = vi.hoisted(() => ({
  current: { state: "qr", qr: "qr-string" } as Record<string, unknown>,
}));
const linkStart = vi.hoisted(() => vi.fn());
const linkPoll = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const disconnect = vi.hoisted(() => vi.fn());

vi.mock("../lib/rpc", () => ({
  rpc: {
    messaging: {
      whatsapp: {
        link: { start: linkStart, status: linkPoll },
        numbers: { update, disconnect },
      },
    },
  },
}));
vi.mock("../lib/query", () => ({
  useSpaceQueries: () => ({
    messaging: {
      whatsapp: {
        numbers: {
          list: {
            queryOptions: () => ({
              queryKey: ["whatsapp-numbers"],
              queryFn: async () => numbers.current,
            }),
          },
        },
      },
    },
    bots: {
      list: {
        queryOptions: () => ({
          queryKey: ["bots"],
          queryFn: async () => [
            { id: "bot-1", name: "Support", archivedAt: null },
            { id: "bot-2", name: "Sales", archivedAt: null },
          ],
        }),
      },
    },
    connections: {
      list: {
        queryOptions: () => ({
          queryKey: ["connections"],
          queryFn: async () => [
            { id: "c1", provider: "linear", displayName: "Linear" },
            { id: "c2", provider: "gmail", displayName: "Gmail" },
          ],
        }),
      },
    },
  }),
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
      ...rest
    }: { children?: ReactNode; onClick?: () => void; disabled?: boolean } & Record<
      string,
      unknown
    >) => createElement("button", { onClick, disabled, ...rest }, children),
  };
});

let root: ReturnType<typeof createRoot> | undefined;
let host: HTMLDivElement;

async function render(botId: string | undefined = "bot-1") {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
      <QueryClientProvider client={client}>
        <WhatsAppNumbers botId={botId} />
      </QueryClientProvider>,
    );
  });
  await settle();
}
/** Lets queued queries and effects run; a few rounds, since each one schedules the next. */
async function settle() {
  for (let round = 0; round < 6; round += 1) {
    await act(async () => {
      await new Promise((done) => setTimeout(done, 5));
    });
  }
}
const flush = settle;
const button = (text: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text) as
    | HTMLButtonElement
    | undefined;
const click = async (text: string) => {
  await act(async () => {
    button(text)?.click();
    await Promise.resolve();
  });
  await settle();
};

beforeEach(() => {
  numbers.current = { available: true, numbers: [] };
  linkStatus.current = { state: "qr", qr: "qr-string" };
  linkStart.mockReset().mockResolvedValue({ linkId: "link-1" });
  linkPoll.mockReset().mockImplementation(async () => linkStatus.current);
  update.mockReset().mockResolvedValue({});
  disconnect.mockReset().mockResolvedValue({ ok: true });
});
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
});

const NUMBER = {
  id: "inst-1",
  number: "+•••••••0100",
  botId: "bot-1",
  botName: "Support",
  status: "active",
  paused: false,
  visitorConnectors: [] as string[],
};

it("shows nothing where linked numbers are not available", async () => {
  numbers.current = { available: false, numbers: [] };
  await render();
  expect(host.textContent).toBe("");
});

it("shows the WhatsApp card with Add, and nothing else before it is used", async () => {
  await render();
  expect(host.textContent).toContain("WhatsApp");
  expect(button("Add")).toBeDefined();
  expect(host.textContent).not.toContain("official API");
});

it("shows the warning and the QR code after Add, for the open agent", async () => {
  await render("bot-2");
  await click("Add");
  await flush();
  expect(linkStart).toHaveBeenCalledWith({ botId: "bot-2" });
  expect(host.textContent).toContain(
    "This uses WhatsApp without the official API. WhatsApp can ban the number.",
  );
  expect(host.querySelector("svg[data-testid='whatsapp-qr']")).not.toBeNull();
});

it("closes the flow and lists the number once it is linked", async () => {
  await render();
  await click("Add");
  await flush();
  linkStatus.current = { state: "linked", number: "+•••••••0100" };
  numbers.current = { available: true, numbers: [NUMBER] };
  await act(async () => {
    await new Promise((done) => setTimeout(done, 1_800));
  });
  await settle();
  expect(host.querySelector("svg[data-testid='whatsapp-qr']")).toBeNull();
  expect(host.textContent).not.toContain("official API");
  expect(host.textContent).toContain("+•••••••0100");
});

it("reports a link that failed, and lets the person try again", async () => {
  await render();
  await click("Add");
  await flush();
  linkStatus.current = { state: "failed" };
  await act(async () => {
    await new Promise((done) => setTimeout(done, 1_800));
  });
  await settle();
  expect(host.textContent).toContain("Could not connect");
  expect(button("Add")).toBeDefined();
});

it("cancels the flow without linking", async () => {
  await render();
  await click("Add");
  await flush();
  await click("Cancel");
  expect(host.querySelector("svg[data-testid='whatsapp-qr']")).toBeNull();
});

it("lists a number with its agent and pauses, resumes and disconnects it", async () => {
  numbers.current = { available: true, numbers: [NUMBER] };
  await render();
  expect(host.textContent).toContain("Support");
  await click("Pause");
  expect(update).toHaveBeenCalledWith({ id: "inst-1", paused: true });
  numbers.current = { available: true, numbers: [{ ...NUMBER, paused: true }] };
  await settle();
  await click("Disconnect");
  expect(disconnect).toHaveBeenCalledWith({ id: "inst-1" });
});

it("moves a number to another agent", async () => {
  numbers.current = { available: true, numbers: [NUMBER] };
  await render();
  await click("Sales");
  expect(update).toHaveBeenCalledWith({ id: "inst-1", botId: "bot-2" });
});

it("offers only the connected apps for visitors, and saves the ticked ones", async () => {
  numbers.current = { available: true, numbers: [{ ...NUMBER, visitorConnectors: ["linear"] }] };
  await render();
  expect(button("Linear")?.getAttribute("aria-pressed")).toBe("true");
  expect(button("Gmail")?.getAttribute("aria-pressed")).toBe("false");
  await click("Gmail");
  expect(update).toHaveBeenCalledWith({ id: "inst-1", visitorConnectors: ["gmail", "linear"] });
});

it("marks a number WhatsApp logged out", async () => {
  numbers.current = { available: true, numbers: [{ ...NUMBER, status: "disconnected" }] };
  await render();
  expect(host.textContent).toContain("Disconnected");
});
