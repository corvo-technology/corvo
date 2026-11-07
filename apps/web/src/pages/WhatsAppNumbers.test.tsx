// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WhatsAppApp, WhatsAppListRow } from "./WhatsAppNumbers";

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
const linkCancel = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
const disconnect = vi.hoisted(() => vi.fn());

vi.mock("../lib/rpc", () => ({
  rpc: {
    messaging: {
      whatsapp: {
        link: { start: linkStart, status: linkPoll, cancel: linkCancel },
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
  type Props = { children?: ReactNode } & Record<string, unknown>;
  const plain =
    (tag: string) =>
    ({ children, ...rest }: Props) =>
      createElement(tag, rest, children);
  return {
    Button: ({ children, onClick, disabled, ...rest }: Props) =>
      createElement("button", { onClick, disabled, ...rest }, children),
    Dialog: ({ open, children }: Props & { open?: boolean }) => (open ? children : null),
    DialogContent: plain("div"),
    DialogHeader: plain("div"),
    DialogTitle: plain("h2"),
    Disclosure: ({ summary, children }: Props & { summary?: ReactNode }) =>
      createElement("div", null, createElement("div", null, summary), children),
    DropdownMenu: plain("div"),
    DropdownMenuContent: plain("div"),
    DropdownMenuItem: ({ children, onClick }: Props & { onClick?: () => void }) =>
      createElement("button", { onClick }, children),
    DropdownMenuTrigger: ({ "aria-label": label, children }: Props) =>
      createElement("button", { "aria-label": label as string }, children),
    OptionSelect: ({
      options,
      value,
      onValueChange,
      "aria-label": label,
    }: {
      options: Array<{ value: string; label: string }>;
      value: string | null;
      onValueChange: (value: string) => void;
      "aria-label"?: string;
    }) =>
      createElement(
        "select",
        {
          "aria-label": label,
          value: value ?? "",
          onChange: (event: { target: { value: string } }) => onValueChange(event.target.value),
        },
        options.map((option) =>
          createElement("option", { key: option.value, value: option.value }, option.label),
        ),
      ),
    RadioGroup: ({
      children,
      value,
      onValueChange,
    }: Props & { value?: string; onValueChange?: (value: string) => void }) =>
      createElement(
        "div",
        {
          "data-value": value,
          onClick: (event: { target: HTMLElement }) => {
            const choice = (event.target as HTMLElement).closest("[data-choice]");
            if (choice) onValueChange?.(choice.getAttribute("data-choice") ?? "");
          },
        },
        children,
      ),
    RadioGroupItem: ({ value, ...rest }: { value: string } & Record<string, unknown>) =>
      createElement("span", { "data-choice": value, ...rest }),
  };
});

let root: ReturnType<typeof createRoot> | undefined;
let host: HTMLDivElement;

async function render(node: ReactNode) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
  });
  await settle();
}
const renderApp = (botId: string | undefined = "bot-1") =>
  render(<WhatsAppApp botId={botId} onBack={() => undefined} />);
/** Lets queued queries and effects run; a few rounds, since each one schedules the next. */
async function settle() {
  for (let round = 0; round < 6; round += 1) {
    await act(async () => {
      await new Promise((done) => setTimeout(done, 5));
    });
  }
}
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
const choose = async (selector: string) => {
  await act(async () => {
    (host.querySelector(selector) as HTMLElement | null)?.click();
  });
  await settle();
};
const pick = async (label: string, value: string) => {
  const select = host.querySelector(`select[aria-label='${label}']`) as HTMLSelectElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    setter?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
};

beforeEach(() => {
  numbers.current = { available: true, numbers: [] };
  linkStatus.current = { state: "qr", qr: "qr-string" };
  linkStart.mockReset().mockResolvedValue({ linkId: "link-1" });
  linkCancel.mockReset().mockResolvedValue({ ok: true });
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
  mode: "assistant",
  visitorConnectors: [] as string[],
};

async function openDialog() {
  await renderApp("bot-2");
  await click("Add number");
}

it("shows nothing in the list where linked numbers are not available", async () => {
  numbers.current = { available: false, numbers: [] };
  await render(<WhatsAppListRow onOpen={() => undefined} />);
  expect(host.textContent).toBe("");
});

it("lists WhatsApp as one line that opens its own screen", async () => {
  numbers.current = { available: true, numbers: [NUMBER] };
  const open = vi.fn();
  await render(<WhatsAppListRow onOpen={open} />);
  expect(host.textContent).toContain("WhatsApp");
  expect(host.textContent).not.toContain("+•••••••0100");
  (host.querySelector("button") as HTMLButtonElement).click();
  expect(open).toHaveBeenCalled();
});

it("offers one way to add a number before any is linked, with no warning yet", async () => {
  await renderApp();
  expect(button("Add number")).toBeDefined();
  expect(host.textContent).not.toContain("official API");
});

it("asks for the agent's role and shows the warning once, before the QR code", async () => {
  await openDialog();
  expect(host.textContent).toContain(
    "This uses WhatsApp without the official API. WhatsApp can ban the number.",
  );
  expect(host.querySelector("svg[data-testid='whatsapp-qr']")).toBeNull();
  await click("Show QR code");
  // The open agent and the safe role are what is chosen when nothing is changed.
  expect(linkStart).toHaveBeenCalledWith({ botId: "bot-2", mode: "assistant" });
  expect(host.querySelector("svg[data-testid='whatsapp-qr']")).not.toBeNull();
  expect(host.textContent).not.toContain("official API");
});

it("links a number for customer service, with the agent that was picked", async () => {
  await openDialog();
  await choose("[data-testid='whatsapp-mode-service']");
  await pick("Agent", "bot-1");
  await click("Show QR code");
  expect(linkStart).toHaveBeenCalledWith({ botId: "bot-1", mode: "service" });
});

it("closes the dialog and lists the number once it is linked", async () => {
  await openDialog();
  await click("Show QR code");
  linkStatus.current = { state: "linked", number: "+•••••••0100" };
  numbers.current = { available: true, numbers: [NUMBER] };
  await act(async () => {
    await new Promise((done) => setTimeout(done, 1_800));
  });
  await settle();
  expect(host.querySelector("[data-testid='whatsapp-link']")).toBeNull();
  expect(host.textContent).toContain("+•••••••0100");
});

it("reports a link that failed, and lets the person try again", async () => {
  await openDialog();
  await click("Show QR code");
  linkStatus.current = { state: "failed" };
  await act(async () => {
    await new Promise((done) => setTimeout(done, 1_800));
  });
  await settle();
  expect(host.textContent).toContain("Could not connect");
  expect(button("Show QR code")).toBeDefined();
});

it("cancels the link, on the server too, without linking", async () => {
  await openDialog();
  await click("Show QR code");
  await click("Cancel");
  expect(host.querySelector("svg[data-testid='whatsapp-qr']")).toBeNull();
  // The connection to WhatsApp is stopped on the server too, not just hidden here.
  expect(linkCancel).toHaveBeenCalledWith({ linkId: "link-1" });
});

it("lists a number with its agent and pauses, resumes and disconnects it", async () => {
  numbers.current = { available: true, numbers: [NUMBER] };
  await renderApp();
  expect(host.querySelector("select[aria-label='Agent']")).not.toBeNull();
  // The list is read again after a change, so it already holds what the server will say.
  numbers.current = { available: true, numbers: [{ ...NUMBER, paused: true }] };
  await click("Pause");
  expect(update).toHaveBeenCalledWith({ id: "inst-1", paused: true });
  expect(host.textContent).toContain("Paused");
  await click("Resume");
  expect(update).toHaveBeenCalledWith({ id: "inst-1", paused: false });
  await click("Disconnect");
  expect(disconnect).toHaveBeenCalledWith({ id: "inst-1" });
});

it("moves a number to another agent", async () => {
  numbers.current = { available: true, numbers: [NUMBER] };
  await renderApp();
  await pick("Agent", "bot-2");
  expect(update).toHaveBeenCalledWith({ id: "inst-1", botId: "bot-2" });
});

it("switches who a number answers", async () => {
  numbers.current = { available: true, numbers: [NUMBER] };
  await renderApp();
  await pick("Answers", "service");
  expect(update).toHaveBeenCalledWith({ id: "inst-1", mode: "service" });
});

it("offers visitor apps only on a customer service number, and saves the ticked ones", async () => {
  numbers.current = { available: true, numbers: [NUMBER] };
  await renderApp();
  expect(host.textContent).not.toContain("Apps visitors can use");
  await act(async () => root?.unmount());
  host.remove();
  numbers.current = {
    available: true,
    numbers: [{ ...NUMBER, mode: "service", visitorConnectors: ["linear"] }],
  };
  await renderApp();
  expect(button("Linear")?.getAttribute("aria-pressed")).toBe("true");
  expect(button("Gmail")?.getAttribute("aria-pressed")).toBe("false");
  await click("Gmail");
  expect(update).toHaveBeenCalledWith({ id: "inst-1", visitorConnectors: ["gmail", "linear"] });
});

it("marks a number WhatsApp logged out, with nothing to pause", async () => {
  numbers.current = { available: true, numbers: [{ ...NUMBER, status: "disconnected" }] };
  await renderApp();
  expect(host.textContent).toContain("Disconnected");
  expect(button("Pause")).toBeUndefined();
});

it("names each number's menu with the number, so a screen reader can tell several apart", async () => {
  numbers.current = {
    available: true,
    numbers: [NUMBER, { ...NUMBER, id: "inst-2", number: "+•••••••0200" }],
  };
  await renderApp();
  const names = [...host.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));
  expect(names).toContain("More +•••••••0100");
  expect(names).toContain("More +•••••••0200");
});
