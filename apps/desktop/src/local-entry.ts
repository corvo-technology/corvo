import { LOCAL_SETTINGS_TOKEN_HEADER } from "@corvo/contracts/local-settings";
import { isLoopbackHost } from "@corvo/contracts/network-host";

export const LOCAL_ENTRY_PATH = "/api/local/enter";

/**
 * Signs the app in to the engine it started on this computer, with no account: the engine opens a
 * session for the person it belongs to when it sees the app-private token. The session cookie lands
 * in the same session the window uses, so `request` must store cookies. Never the token in a URL.
 */
export async function enterLocalOwner(
  target: { origin: string; token: string },
  request: typeof fetch,
): Promise<void> {
  const url = new URL(target.origin);
  if (
    url.origin !== target.origin ||
    !["http:", "https:"].includes(url.protocol) ||
    !isLoopbackHost(url.hostname)
  ) {
    throw new Error("Invalid local server address");
  }
  const response = await request(`${target.origin}${LOCAL_ENTRY_PATH}`, {
    method: "GET",
    headers: { [LOCAL_SETTINGS_TOKEN_HEADER]: target.token },
    credentials: "include",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Could not open the local server");
}
