import type { AppCatalogEntry, McpServer } from "@corvo/contracts";
import { appCatalogToMcpConfig } from "@corvo/core";
import { connectMcpOauth, type McpOauthResult } from "./mcp-connect";
import { rpc } from "./rpc";

/** Let an agent use a server added for the whole space; safe to repeat. */
export function giveAgentAccess(botId: string, serverId: string) {
  return rpc.mcp.assignments.approve({ botId, serverId });
}

/**
 * Add a catalog app as an MCP server (or reuse the one already added), then sign in when it needs
 * OAuth. With a botId the agent the app was added from gets to use it, since a server added on
 * its own is invisible to every agent.
 */
export async function connectCatalogApp(
  entry: AppCatalogEntry,
  opts: { key?: string; existing?: McpServer; botId?: string },
): Promise<{ server: McpServer; oauth: McpOauthResult | null }> {
  const server =
    opts.existing ?? (await rpc.mcp.servers.create(appCatalogToMcpConfig(entry, opts.key)));
  const oauth = entry.auth.kind === "oauth" ? await connectMcpOauth(server.id) : null;
  if (opts.botId && oauth !== "cancelled") await giveAgentAccess(opts.botId, server.id);
  return { server, oauth };
}
