import type { AppCatalogEntry, McpServer } from "@corvo/contracts";
import { appCatalogToMcpConfig } from "@corvo/core";
import { connectMcpOauth, type McpOauthResult } from "./mcp-connect";
import { rpc } from "./rpc";

/** Add a catalog app as an MCP server (or reuse the one already added), then sign in when it needs OAuth. */
export async function connectCatalogApp(
  entry: AppCatalogEntry,
  opts: { key?: string; existing?: McpServer },
): Promise<{ server: McpServer; oauth: McpOauthResult | null }> {
  const server =
    opts.existing ?? (await rpc.mcp.servers.create(appCatalogToMcpConfig(entry, opts.key)));
  if (entry.auth.kind !== "oauth") return { server, oauth: null };
  return { server, oauth: await connectMcpOauth(server.id) };
}
