import type { AppCatalogEntry, McpServer } from "@corvo/contracts";
import { appCatalogToMcpConfig, matchAddedServer } from "@corvo/core";
import { rpc } from "./api";

/**
 * Mobile has no MCP browser sign-in or key entry yet, so it only offers apps that connect with
 * neither; OAuth and key apps are added on web or desktop and then show in the server list.
 */
export function mobileAddableApps(
  apps: readonly AppCatalogEntry[],
  servers: readonly McpServer[],
): AppCatalogEntry[] {
  return apps.filter((app) => app.auth.kind === "none" && !matchAddedServer(app, servers));
}

export function addCatalogApp(entry: AppCatalogEntry) {
  return rpc("mcp/servers/create", appCatalogToMcpConfig(entry));
}
