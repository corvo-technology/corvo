// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const begin = vi.hoisted(() => vi.fn());
const complete = vi.hoisted(() => vi.fn());
vi.mock("./rpc", () => ({ rpc: { mcp: { oauth: { begin, complete } } } }));

const embedded = vi.hoisted(() => ({ value: false }));
vi.mock("./embed", () => ({ isEmbedded: () => embedded.value }));

import { connectMcpOauth, MCP_OAUTH_CHANNEL } from "./mcp-connect";

const authorizationUrl = "https://provider.example/authorize?state=session-1";

type Callback = { code: string; state?: string };

function installBridge(open: (url: string) => Promise<void>) {
  let listener: ((callback: Callback) => void) | undefined;
  const oauth = {
    open: vi.fn(open),
    cancel: vi.fn().mockResolvedValue(undefined),
    onCallback: vi.fn((next: (callback: Callback) => void) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    }),
  };
  (window as unknown as { corvoDesktop?: unknown }).corvoDesktop = { oauth };
  return { oauth, emit: (callback: Callback) => listener?.(callback) };
}

beforeEach(() => {
  embedded.value = false;
  vi.useFakeTimers();
  localStorage.clear();
  begin.mockReset().mockResolvedValue({
    status: "authorization_required",
    sessionId: "session-1",
    authorizationUrl,
  });
  complete.mockReset().mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (window as unknown as { corvoDesktop?: unknown }).corvoDesktop;
});

describe("connectMcpOauth in the desktop app", () => {
  it("opens the system browser with a loopback redirect, not an in-app popup", async () => {
    const bridge = installBridge(async () => undefined);
    const popup = vi.spyOn(window, "open");
    const result = connectMcpOauth("server-1");
    await vi.advanceTimersByTimeAsync(0);

    const { redirectUri } = (begin.mock.calls[0] as [{ redirectUri: string }])[0];
    const match = /^http:\/\/127\.0\.0\.1:(\d+)\/mcp\/oauth\/callback$/.exec(redirectUri);
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBeGreaterThanOrEqual(49152);
    expect(bridge.oauth.open).toHaveBeenCalledWith(authorizationUrl);
    expect(popup).not.toHaveBeenCalled();

    bridge.emit({ code: "code-1", state: "session-1" });
    await expect(result).resolves.toBe("connected");
  });

  it("finishes the connection with the code the system browser returned", async () => {
    const bridge = installBridge(async () => undefined);
    const result = connectMcpOauth("server-1");
    await vi.advanceTimersByTimeAsync(0);
    bridge.emit({ code: "code-1", state: "session-1" });
    await result;
    expect(complete).toHaveBeenCalledWith({
      sessionId: "session-1",
      code: "code-1",
      state: "session-1",
    });
  });

  it("ignores a code captured for another attempt", async () => {
    const bridge = installBridge(async () => undefined);
    const result = connectMcpOauth("server-1");
    await vi.advanceTimersByTimeAsync(0);
    bridge.emit({ code: "stale", state: "someone-else" });
    expect(complete).not.toHaveBeenCalled();
    bridge.emit({ code: "code-1", state: "session-1" });
    await expect(result).resolves.toBe("connected");
    expect(complete).toHaveBeenCalledOnce();
  });

  it("returns on the same port every time, so the client registered earlier is reused", async () => {
    const bridge = installBridge(async () => undefined);
    const ports: string[] = [];
    for (let i = 0; i < 3; i++) {
      const result = connectMcpOauth("server-1");
      await vi.advanceTimersByTimeAsync(0);
      ports.push(new URL(begin.mock.lastCall?.[0].redirectUri).port);
      bridge.emit({ code: "code-1", state: "session-1" });
      await result;
    }
    expect(new Set(ports).size).toBe(1);
  });

  it("works when the browser keeps no storage", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const bridge = installBridge(async () => undefined);
    const result = connectMcpOauth("server-1");
    await vi.advanceTimersByTimeAsync(0);
    bridge.emit({ code: "code-1", state: "session-1" });
    await expect(result).resolves.toBe("connected");
  });

  it("tries another port when the first cannot be listened on", async () => {
    let calls = 0;
    const bridge = installBridge(async () => {
      calls += 1;
      if (calls === 1) throw new Error("port in use");
    });
    const result = connectMcpOauth("server-1");
    await vi.advanceTimersByTimeAsync(0);
    expect(begin).toHaveBeenCalledTimes(2);
    const ports = begin.mock.calls.map((call) => new URL(call[0].redirectUri).port);
    expect(ports[0]).not.toBe(ports[1]);
    bridge.emit({ code: "code-1", state: "session-1" });
    await expect(result).resolves.toBe("connected");

    // The port that worked is the one used next time.
    const next = connectMcpOauth("server-1");
    await vi.advanceTimersByTimeAsync(0);
    expect(new URL(begin.mock.lastCall?.[0].redirectUri).port).toBe(ports[1]);
    bridge.emit({ code: "code-1", state: "session-1" });
    await next;
  });

  it("gives up with the error after three ports fail", async () => {
    installBridge(async () => {
      throw new Error("port in use");
    });
    const result = connectMcpOauth("server-1");
    const assertion = expect(result).rejects.toThrow("port in use");
    await vi.advanceTimersByTimeAsync(0);
    await assertion;
    expect(begin).toHaveBeenCalledTimes(3);
  });

  it("is cancelled, and the listener released, when the person never comes back", async () => {
    const bridge = installBridge(async () => undefined);
    const result = connectMcpOauth("server-1");
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    await expect(result).resolves.toBe("cancelled");
    expect(bridge.oauth.cancel).toHaveBeenCalledWith(authorizationUrl);
  });

  it("passes on a failure to finish the connection", async () => {
    const bridge = installBridge(async () => undefined);
    complete.mockRejectedValue(new Error("exchange failed"));
    const result = connectMcpOauth("server-1");
    const assertion = expect(result).rejects.toThrow("exchange failed");
    await vi.advanceTimersByTimeAsync(0);
    bridge.emit({ code: "code-1", state: "session-1" });
    await assertion;
  });

  it("does nothing more when the server is already connected", async () => {
    const bridge = installBridge(async () => undefined);
    begin.mockResolvedValue({ status: "already_connected" });
    await expect(connectMcpOauth("server-1")).resolves.toBe("already_connected");
    expect(bridge.oauth.open).not.toHaveBeenCalled();
  });
});

describe("connectMcpOauth in a browser", () => {
  it("opens a normal tab instead of a popup window", async () => {
    const tab = { closed: false, close: vi.fn() } as unknown as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(tab);
    const result = connectMcpOauth("server-1");
    await vi.advanceTimersByTimeAsync(0);

    expect(open).toHaveBeenCalledWith(authorizationUrl, MCP_OAUTH_CHANNEL);
    const { redirectUri } = (begin.mock.calls[0] as [{ redirectUri: string }])[0];
    expect(redirectUri).toBe(`${window.location.origin}/mcp/oauth/callback`);

    (tab as { closed: boolean }).closed = true;
    await vi.advanceTimersByTimeAsync(600);
    await expect(result).resolves.toBe("cancelled");
  });
});

describe("connectMcpOauth inside a partner's frame", () => {
  it("refuses before starting, because the provider's tab could not sign in as the frame", async () => {
    embedded.value = true;
    await expect(connectMcpOauth("server-1")).rejects.toThrow();
    expect(begin).not.toHaveBeenCalled();
  });
});
