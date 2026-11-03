import { t } from "@lingui/core/macro";
import type { CorvoDesktop } from "./desktop";
import { desktopBridge } from "./desktop";
import { isEmbedded } from "./embed";
import { MCP_OAUTH_CHANNEL } from "./mcp-oauth-channel";
import { rpc } from "./rpc";

export { MCP_OAUTH_CHANNEL } from "./mcp-oauth-channel";

const MCP_OAUTH_TIMEOUT_MS = 2 * 60 * 1000;
/** The desktop app listens on one of these while the provider's page is open in the browser. */
const LOOPBACK_PORT_MIN = 49152;
const LOOPBACK_PORT_SPAN = 16384;
const LOOPBACK_ATTEMPTS = 3;
const LOOPBACK_PORT_KEY = "corvo.mcp-oauth-port";

export type McpOauthResult =
  | "connected"
  | "cancelled"
  | "already_connected"
  | "authorization_not_requested";

/** Where providers send the user back; a pre-registered client must allow it. */
export function mcpOAuthRedirectUri(): string {
  return `${window.location.origin}/mcp/oauth/callback`;
}

/**
 * Connect an MCP server through its provider's OAuth page.
 *
 * The desktop app opens the system browser, where the person is usually already signed in, and
 * receives the code on a loopback address it listens on; some providers accept only that kind of
 * redirect, so it also works whichever server the app is connected to. A web browser opens a
 * normal tab and waits until the callback page broadcasts completion or the tab is closed.
 *
 * The BroadcastChannel (not window.opener) is the completion signal because
 * provider login pages with COOP sever the opener link. */
export async function connectMcpOauth(serverId: string): Promise<McpOauthResult> {
  // The provider's page opens in a tab that has none of the frame's in-memory sign-in, so it
  // would finish as whoever else is signed in to this browser, or as no one.
  if (isEmbedded()) throw new Error(t`Open Rook directly to connect this app.`);
  const browser = desktopBridge()?.oauth;
  if (browser?.open) return connectInSystemBrowser(serverId, { ...browser, open: browser.open });
  const started = await rpc.mcp.oauth.begin({ serverId, redirectUri: mcpOAuthRedirectUri() });
  if (started.status !== "authorization_required") return started.status;
  // A tab, not a popup window: it opens where the person already is signed in to the provider.
  const popup = window.open(started.authorizationUrl, MCP_OAUTH_CHANNEL);
  if (!popup) {
    // Blocked: navigate this tab instead; the callback page returns to /app.
    window.location.assign(started.authorizationUrl);
    return "cancelled";
  }
  return await new Promise<McpOauthResult>((resolve) => {
    const channel = new BroadcastChannel(MCP_OAUTH_CHANNEL);
    let settled = false;
    let pollTimer = 0;
    let timeoutTimer = 0;
    const finish = (result: McpOauthResult) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollTimer);
      window.clearTimeout(timeoutTimer);
      channel.close();
      resolve(result);
    };
    pollTimer = window.setInterval(() => {
      if (!popup.closed) return;
      finish("cancelled");
    }, 500);
    timeoutTimer = window.setTimeout(() => {
      popup.close();
      finish("cancelled");
    }, MCP_OAUTH_TIMEOUT_MS);
    channel.onmessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type !== "mcp-oauth-complete") return;
      finish("connected");
    };
  });
}

type SystemBrowser = NonNullable<CorvoDesktop["oauth"]> & { open: (url: string) => Promise<void> };

function randomPort(): number {
  return LOOPBACK_PORT_MIN + Math.floor(Math.random() * LOOPBACK_PORT_SPAN);
}

/** The port that last worked, so one redirect serves every attempt and a registered client stays valid. */
function rememberedPort(): number | undefined {
  try {
    const port = Number(localStorage.getItem(LOOPBACK_PORT_KEY));
    return Number.isInteger(port) && port >= LOOPBACK_PORT_MIN ? port : undefined;
  } catch {
    return undefined;
  }
}

function rememberPort(port: number | undefined): void {
  try {
    if (port === undefined) localStorage.removeItem(LOOPBACK_PORT_KEY);
    else localStorage.setItem(LOOPBACK_PORT_KEY, String(port));
  } catch {
    // Without storage every attempt picks its own port.
  }
}

async function connectInSystemBrowser(
  serverId: string,
  browser: SystemBrowser,
): Promise<McpOauthResult> {
  let port = rememberedPort() ?? randomPort();
  for (let attempt = 1; ; attempt++) {
    const redirectUri = `http://127.0.0.1:${port}/mcp/oauth/callback`;
    const started = await rpc.mcp.oauth.begin({ serverId, redirectUri });
    if (started.status !== "authorization_required") return started.status;
    const { sessionId, authorizationUrl } = started;
    // The desktop app cannot listen when the port is taken; the next attempt picks another.
    const outcome = await new Promise<McpOauthResult | { unavailable: unknown }>(
      (resolve, reject) => {
        let timeout = 0;
        let release = () => {};
        const settle = (result: McpOauthResult | { unavailable: unknown }) => {
          window.clearTimeout(timeout);
          release();
          resolve(result);
        };
        release = browser.onCallback((callback) => {
          // A code captured for another attempt must not be spent on this one.
          if (callback.state !== sessionId) return;
          window.clearTimeout(timeout);
          release();
          rpc.mcp.oauth
            .complete({ sessionId, code: callback.code, state: callback.state })
            .then(() => resolve("connected"), reject);
        });
        timeout = window.setTimeout(() => {
          void browser.cancel?.(authorizationUrl).catch(() => undefined);
          settle("cancelled");
        }, MCP_OAUTH_TIMEOUT_MS);
        browser.open(authorizationUrl).then(
          () => rememberPort(port),
          (unavailable: unknown) => settle({ unavailable }),
        );
      },
    );
    if (typeof outcome === "string") return outcome;
    rememberPort(undefined);
    if (attempt >= LOOPBACK_ATTEMPTS) throw outcome.unavailable;
    port = randomPort();
  }
}
