// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.hoisted(() => ({
  bots: { list: vi.fn() },
  mcp: {
    servers: { list: vi.fn(), create: vi.fn(), remove: vi.fn() },
    assignments: { all: vi.fn(), replace: vi.fn() },
  },
}));
vi.mock("../lib/rpc", () => ({ rpc: rpcMock }));
vi.mock("@lingui/react/macro", () => {
  const t = (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((text, part, index) => `${text}${index > 0 ? values[index - 1] : ""}${part}`, "");
  return { useLingui: () => ({ t }), Trans: ({ children }: { children: ReactNode }) => children };
});

import { DesktopControlSettings } from "./DesktopControlSettings";

type Status = {
  supported: boolean;
  installed: boolean;
  permissions: { accessibility: string; screenRecording: string };
};
const ready: Status = {
  supported: true,
  installed: true,
  permissions: { accessibility: "granted", screenRecording: "unknown" },
};
const denied: Status = {
  ...ready,
  permissions: { accessibility: "denied", screenRecording: "unknown" },
};
const server = { id: "srv1", slug: "desktop-control", enabled: true };

const bridge = {
  status: vi.fn(),
  prepare: vi.fn(),
  openPermissionGuide: vi.fn(),
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  bridge.status.mockReset().mockResolvedValue({ ...ready, installed: false });
  bridge.prepare.mockReset().mockResolvedValue({ command: "/data/launch.sh", status: ready });
  bridge.openPermissionGuide.mockReset().mockResolvedValue(undefined);
  rpcMock.mcp.servers.list.mockReset().mockResolvedValue([]);
  rpcMock.mcp.servers.create.mockReset().mockResolvedValue(server);
  rpcMock.mcp.servers.remove.mockReset().mockResolvedValue({ ok: true });
  rpcMock.bots.list.mockReset().mockResolvedValue([{ id: "chief" }, { id: "bento" }]);
  rpcMock.mcp.assignments.all
    .mockReset()
    .mockResolvedValue([
      { botId: "bento", serverId: "stripe", allowAllTools: false, allowedTools: ["list_invoices"] },
    ]);
  rpcMock.mcp.assignments.replace.mockReset().mockResolvedValue([]);
  (window as { corvoDesktop?: unknown }).corvoDesktop = { desktopControl: bridge };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  delete (window as { corvoDesktop?: unknown }).corvoDesktop;
  act(() => root.unmount());
  container.remove();
});

async function render() {
  await act(async () => root.render(<DesktopControlSettings />));
}
const toggle = () => container.querySelector('[role="switch"]') as HTMLButtonElement;
const text = () => container.textContent ?? "";
const button = (label: string) =>
  [...container.querySelectorAll("button")].find((item) => item.textContent === label);

describe("DesktopControlSettings", () => {
  it("is absent outside the desktop app and on a computer the tool does not support", async () => {
    delete (window as { corvoDesktop?: unknown }).corvoDesktop;
    await render();
    expect(container.innerHTML).toBe("");
    (window as { corvoDesktop?: unknown }).corvoDesktop = { desktopControl: bridge };
    bridge.status.mockResolvedValue({ ...ready, supported: false });
    await render();
    expect(toggle()).toBeNull();
  });

  it("starts off, and turning it on installs the tool and adds its server", async () => {
    await render();
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    await act(async () => toggle().click());
    expect(bridge.prepare).toHaveBeenCalledOnce();
    expect(rpcMock.mcp.servers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        transport: "stdio",
        slug: "desktop-control",
        command: "/data/launch.sh",
        args: [],
        env: {},
      }),
    );
    expect(toggle().getAttribute("aria-checked")).toBe("true");
  });

  it("gives every bot the tools at once, keeping what each already has", async () => {
    await render();
    await act(async () => toggle().click());
    const everything = { serverId: "srv1", allowAllTools: true, allowedTools: [] };
    expect(rpcMock.mcp.assignments.replace).toHaveBeenCalledTimes(2);
    expect(rpcMock.mcp.assignments.replace).toHaveBeenCalledWith({
      botId: "chief",
      assignments: [everything],
    });
    expect(rpcMock.mcp.assignments.replace).toHaveBeenCalledWith({
      botId: "bento",
      assignments: [
        { serverId: "stripe", allowAllTools: false, allowedTools: ["list_invoices"] },
        everything,
      ],
    });
  });

  it("stays off when the person declines the app's question", async () => {
    bridge.prepare.mockResolvedValue(null);
    await render();
    await act(async () => toggle().click());
    expect(rpcMock.mcp.servers.create).not.toHaveBeenCalled();
    expect(toggle().getAttribute("aria-checked")).toBe("false");
  });

  it("turning it off removes the server", async () => {
    rpcMock.mcp.servers.list.mockResolvedValue([server]);
    bridge.status.mockResolvedValue(ready);
    await render();
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    await act(async () => toggle().click());
    expect(rpcMock.mcp.servers.remove).toHaveBeenCalledWith({ id: "srv1" });
    expect(toggle().getAttribute("aria-checked")).toBe("false");
  });

  it("asks for the system permission while it is on and not granted, and can check again", async () => {
    rpcMock.mcp.servers.list.mockResolvedValue([server]);
    bridge.status.mockResolvedValue(denied);
    await render();
    expect(text()).toContain("Allow Corvo under Accessibility");
    await act(async () => button("Open privacy settings")?.click());
    expect(bridge.openPermissionGuide).toHaveBeenCalledOnce();
    bridge.status.mockResolvedValue(ready);
    await act(async () => button("Check again")?.click());
    expect(text()).not.toContain("Allow Corvo under Accessibility");
  });

  it("says nothing about permissions once access works", async () => {
    rpcMock.mcp.servers.list.mockResolvedValue([server]);
    bridge.status.mockResolvedValue(ready);
    await render();
    expect(text()).not.toContain("Accessibility");
  });
});
