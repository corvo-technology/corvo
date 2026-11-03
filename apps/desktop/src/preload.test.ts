import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import type { CorvoDesktop, CorvoSetup } from "@corvo/contracts";
import { describe, expect, it, vi } from "vitest";

function runPreload(file: string, ipc: { invoke?: unknown; on?: unknown; off?: unknown } = {}) {
  const invoke =
    (ipc.invoke as ReturnType<typeof vi.fn>) ?? vi.fn(async (channel: string) => ({ channel }));
  const on = (ipc.on as ReturnType<typeof vi.fn>) ?? vi.fn();
  const off = (ipc.off as ReturnType<typeof vi.fn>) ?? vi.fn();
  const exposeInMainWorld = vi.fn();
  const source = readFileSync(path.join(import.meta.dirname, file), "utf8");

  vm.runInNewContext(source, {
    process: { platform: "linux" },
    require(moduleName: string) {
      if (moduleName !== "electron") throw new Error(`Unexpected preload import: ${moduleName}`);
      return { contextBridge: { exposeInMainWorld }, ipcRenderer: { invoke, on, off } };
    },
  });

  return { invoke, on, off, exposeInMainWorld };
}

describe("desktop preload bridge", () => {
  it("exposes the scoped desktop bridges", async () => {
    const { invoke, exposeInMainWorld } = runPreload("preload.cjs");

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [globalName, bridge] = exposeInMainWorld.mock.calls[0] as [string, CorvoDesktop];
    expect(globalName).toBe("corvoDesktop");
    expect(bridge.platform).toBe("linux");
    expect(Object.keys(bridge).sort()).toEqual([
      "badge",
      "computer",
      "connections",
      "desktopControl",
      "oauth",
      "passkeys",
      "platform",
      "settings",
      "tools",
      "update",
      "window",
    ]);
    expect(Object.keys(bridge.window).sort()).toEqual([
      "close",
      "minimize",
      "state",
      "toggleMaximize",
    ]);
    expect(Object.keys(bridge.update).sort()).toEqual(["check", "download", "install", "state"]);

    expect(Object.keys(bridge.badge!)).toEqual(["set"]);
    await bridge.badge!.set(7);
    expect(invoke).toHaveBeenCalledWith("desktop.badge.set", 7);

    await bridge.oauth.open?.("https://provider.example.com/authorize");
    await bridge.oauth.cancel?.("https://provider.example.com/authorize");
    await bridge.passkeys?.rpIds();
    await bridge.window.close();
    await bridge.window.minimize();
    await bridge.window.toggleMaximize();
    await bridge.window.state();
    await bridge.update.state();
    await bridge.update.check();
    await bridge.update.download();
    await bridge.update.install();
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      "desktop.badge.set",
      "desktop.oauth.open",
      "desktop.oauth.cancel",
      "desktop.passkeys.rpIds",
      "desktop.window.close",
      "desktop.window.minimize",
      "desktop.window.toggleMaximize",
      "desktop.window.state",
      "desktop.update.state",
      "desktop.update.check",
      "desktop.update.download",
      "desktop.update.install",
    ]);
  });

  it("forwards captured codes without leaking the IPC event to the renderer", () => {
    const listeners: Array<(event: unknown, callback: unknown) => void> = [];
    const on = vi.fn((_channel: string, handler: (event: unknown, callback: unknown) => void) => {
      listeners.push(handler);
    });
    const off = vi.fn();
    const { exposeInMainWorld } = runPreload("preload.cjs", { on, off });

    const [, bridge] = exposeInMainWorld.mock.calls[0] as [string, CorvoDesktop];
    const received: unknown[] = [];
    const unsubscribe = bridge.oauth.onCallback((callback) => received.push(callback));

    expect(on).toHaveBeenCalledWith("desktop.oauth.callback", expect.any(Function));
    listeners[0]?.({ sender: "ipc-event" }, { code: "ac_123", state: "verifier_456" });
    expect(received).toEqual([{ code: "ac_123", state: "verifier_456" }]);

    unsubscribe();
    expect(off).toHaveBeenCalledWith("desktop.oauth.callback", expect.any(Function));
  });
});

describe("setup preload bridge", () => {
  it("exposes only the first-run setup operations", async () => {
    const { invoke, on, exposeInMainWorld } = runPreload("setup-preload.cjs");

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [globalName, bridge] = exposeInMainWorld.mock.calls[0] as [string, CorvoSetup];
    expect(globalName).toBe("corvoSetup");
    expect(bridge.platform).toBe("linux");
    expect(Object.keys(bridge).sort()).toEqual([
      "platform",
      "quit",
      "save",
      "setLocale",
      "stack",
      "state",
      "test",
    ]);
    expect(Object.keys(bridge.stack).sort()).toEqual(["onChange", "start", "state"]);

    await bridge.state();
    await bridge.test("http://127.0.0.1:5173");
    await bridge.save({ mode: "new", serverUrl: "http://127.0.0.1:5173" });
    await bridge.quit();
    await bridge.setLocale("pt-BR");
    await bridge.stack.state();
    await bridge.stack.start();
    expect(invoke.mock.calls.map(([channel]) => channel)).toEqual([
      "desktop.setup.state",
      "desktop.setup.test",
      "desktop.setup.save",
      "desktop.setup.quit",
      "desktop.setup.locale.set",
      "desktop.setup.stack.state",
      "desktop.setup.stack.start",
    ]);

    const listener = vi.fn();
    bridge.stack.onChange(listener);
    const [channel, handler] = on.mock.calls.at(-1) as [string, (...args: unknown[]) => void];
    expect(channel).toBe("desktop.setup.stack.changed");
    handler({}, { phase: "starting" });
    expect(listener).toHaveBeenCalledWith({ phase: "starting" });
  });
});

describe("the app's language follows the one chosen in setup", () => {
  /** Runs the preload as a page would see it, with this storage and the language setup chose. */
  function loadWith(setupLocale: string | null, stored: Record<string, string>) {
    const storage = new Map(Object.entries(stored));
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    };
    vm.runInNewContext(readFileSync(path.join(import.meta.dirname, "preload.cjs"), "utf8"), {
      process: { platform: "darwin" },
      window: { localStorage },
      require: () => ({
        contextBridge: { exposeInMainWorld: vi.fn() },
        ipcRenderer: { invoke: vi.fn(), on: vi.fn(), off: vi.fn(), sendSync: () => setupLocale },
      }),
    });
    return storage;
  }

  it("applies the setup language when the app has none yet", () => {
    const storage = loadWith("pt-BR", {});
    expect(storage.get("corvo.uiLocale")).toBe("pt-BR");
  });

  it("applies a setup language the app has not followed yet, over an older one", () => {
    const storage = loadWith("en", { "corvo.uiLocale": "pt-BR" });
    expect(storage.get("corvo.uiLocale")).toBe("en");
    expect(storage.get("corvo.setupLocaleSynced")).toBe("en");
  });

  it("keeps a language the person changed in the app after setup", () => {
    const storage = loadWith("en", {
      "corvo.uiLocale": "pt-BR",
      "corvo.setupLocaleSynced": "en",
    });
    expect(storage.get("corvo.uiLocale")).toBe("pt-BR");
  });

  it("follows setup again when the setup language changes", () => {
    const storage = loadWith("pt-BR", {
      "corvo.uiLocale": "en",
      "corvo.setupLocaleSynced": "en",
    });
    expect(storage.get("corvo.uiLocale")).toBe("pt-BR");
  });

  it("leaves the app alone when setup has not chosen a language", () => {
    const storage = loadWith(null, { "corvo.uiLocale": "fr" });
    expect(storage.get("corvo.uiLocale")).toBe("fr");
  });
});
