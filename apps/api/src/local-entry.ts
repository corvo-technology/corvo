import type { Hono } from "hono";

export const LOCAL_ENTRY_PATH = "/api/local/enter";

/**
 * Where the desktop app's own process signs in to the engine it started. The auth service checks
 * the app-private token and opens the session; this only passes the request through and returns
 * its cookie. Anyone without the token, a browser included, gets the same refusal.
 */
export function mountLocalEntryRoute(
  app: Hono,
  deps: { enter(input: { headers: Headers }): Promise<Response> },
): void {
  app.get(LOCAL_ENTRY_PATH, async (c) => {
    const response = await deps.enter({ headers: c.req.raw.headers });
    return response.ok ? response : c.json({ error: "Unauthorized" }, 401);
  });
}
