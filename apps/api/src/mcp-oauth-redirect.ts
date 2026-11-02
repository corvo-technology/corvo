const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const CALLBACK_PATH = "/mcp/oauth/callback";

/**
 * Where an MCP authorization may send the browser back to: the app's own callback page, or the
 * loopback address the desktop app listens on while the provider's page is open in the system
 * browser. Some providers (Canva) accept only loopback redirects, so the desktop app uses one
 * whatever server it is connected to.
 */
export function mcpOAuthRedirectAllowed(redirectUri: string, webOrigin: string): boolean {
  let target: URL;
  try {
    target = new URL(redirectUri);
  } catch {
    return false;
  }
  if (target.toString() === new URL(CALLBACK_PATH, webOrigin).toString()) return true;
  return (
    target.protocol === "http:" &&
    LOOPBACK_HOSTS.has(target.hostname) &&
    target.pathname === CALLBACK_PATH &&
    !target.search &&
    !target.hash &&
    !target.username &&
    !target.password &&
    target.port !== "" &&
    Number(target.port) >= 1024
  );
}
