import type {
  AppCatalogEntry,
  AppCategory,
  McpServer,
  McpServerConfigInput,
} from "@corvo/contracts";

/** The MCP server config that adds `entry`; a key entry needs the person's key. */
export function appCatalogToMcpConfig(entry: AppCatalogEntry, key?: string): McpServerConfigInput {
  const base = {
    slug: entry.slug,
    name: entry.name,
    description: entry.tagline,
    transport: entry.transport,
    endpoint: entry.endpoint,
    enabled: true,
  };
  if (entry.auth.kind !== "key") return { ...base, headers: {} };
  const trimmed = key?.trim();
  if (!trimmed) throw new Error("Key required");
  const value = entry.auth.scheme === "bearer" ? `Bearer ${trimmed}` : trimmed;
  return { ...base, headers: { [entry.auth.header]: value } };
}

/** The apps whose sign-in can finish here; a desktop-only app needs the system browser. */
export function appsForSurface(
  entries: readonly AppCatalogEntry[],
  opts: { systemBrowser: boolean },
): AppCatalogEntry[] {
  return entries.filter((entry) => !entry.desktopOnly || opts.systemBrowser);
}

/** Featured apps first, then alphabetical; `query` matches name and tagline. */
export function filterAppCatalog(
  entries: readonly AppCatalogEntry[],
  opts: { query: string; category: AppCategory | null },
): AppCatalogEntry[] {
  const query = opts.query.trim().toLowerCase();
  return entries
    .filter((entry) => !opts.category || entry.category === opts.category)
    .filter(
      (entry) =>
        !query ||
        entry.name.toLowerCase().includes(query) ||
        entry.tagline.toLowerCase().includes(query),
    )
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name, "en"));
}

/** The server already added for `entry`, found by slug or by the same endpoint. */
export function matchAddedServer(
  entry: AppCatalogEntry,
  servers: readonly McpServer[],
): McpServer | undefined {
  return servers.find((server) => server.slug === entry.slug || server.endpoint === entry.endpoint);
}
