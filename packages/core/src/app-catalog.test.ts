import type { AppCatalogEntry, McpServer } from "@corvo/contracts";
import { McpServerConfigInput } from "@corvo/contracts";
import { describe, expect, it } from "vitest";
import {
  appCatalogToMcpConfig,
  appsForSurface,
  filterAppCatalog,
  matchAddedServer,
} from "./app-catalog.js";

function entry(overrides: Partial<AppCatalogEntry> = {}): AppCatalogEntry {
  return {
    slug: "linear",
    name: "Linear",
    tagline: "Issues and project triage",
    category: "coding",
    iconUrl: "https://linear.app/favicon.ico",
    featured: false,
    endpoint: "https://mcp.linear.app/mcp",
    transport: "streamable_http",
    auth: { kind: "oauth" },
    prompts: [],
    ...overrides,
  };
}

const keyAuth = {
  kind: "key",
  header: "Authorization",
  scheme: "bearer",
  label: "API key",
  hint: "Find it in Settings",
  docsUrl: "https://example.com/docs",
} as const;

function server(overrides: Partial<McpServer> = {}): McpServer {
  return {
    id: "srv_1",
    spaceId: "spc_1",
    slug: "other",
    name: "Other",
    description: "",
    transport: "streamable_http",
    endpoint: "https://other.example.com/mcp",
    command: null,
    args: [],
    envKeys: [],
    fileKeys: [],
    headerKeys: [],
    hasSecret: false,
    oauthStatus: "none",
    oauthClientId: null,
    health: { status: "unknown" },
    enabled: true,
    revision: 1,
    createdAt: "2026-10-27T00:00:00.000Z",
    updatedAt: "2026-10-27T00:00:00.000Z",
    ...overrides,
  } as McpServer;
}

describe("appCatalogToMcpConfig", () => {
  it("converts an oauth entry without secret or headers", () => {
    const config = appCatalogToMcpConfig(entry());
    expect(config).toMatchObject({
      slug: "linear",
      name: "Linear",
      transport: "streamable_http",
      endpoint: "https://mcp.linear.app/mcp",
      headers: {},
      enabled: true,
    });
    expect("secret" in config ? config.secret : undefined).toBeUndefined();
    expect(() => McpServerConfigInput.parse(config)).not.toThrow();
  });

  it("converts a no-auth entry like an oauth one, without headers", () => {
    const config = appCatalogToMcpConfig(entry({ auth: { kind: "none" } }));
    expect(config).toMatchObject({ endpoint: "https://mcp.linear.app/mcp", headers: {} });
    expect(() => McpServerConfigInput.parse(config)).not.toThrow();
  });

  it("puts a bearer key in the configured header", () => {
    const config = appCatalogToMcpConfig(entry({ auth: keyAuth }), "  sk-test  ");
    expect(config).toMatchObject({ headers: { Authorization: "Bearer sk-test" } });
    expect(() => McpServerConfigInput.parse(config)).not.toThrow();
  });

  it("puts a raw key in the configured header as is", () => {
    const config = appCatalogToMcpConfig(
      entry({ auth: { ...keyAuth, header: "x-api-key", scheme: "raw" } }),
      "abc123",
    );
    expect(config).toMatchObject({ headers: { "x-api-key": "abc123" } });
  });

  it("rejects a blank key", () => {
    expect(() => appCatalogToMcpConfig(entry({ auth: keyAuth }), "   ")).toThrow("Key required");
    expect(() => appCatalogToMcpConfig(entry({ auth: keyAuth }))).toThrow("Key required");
  });
});

describe("filterAppCatalog", () => {
  const entries = [
    entry({ slug: "zeta", name: "Zeta", tagline: "Zeta things", featured: false }),
    entry({ slug: "alpha", name: "Alpha", tagline: "Alpha things", featured: false }),
    entry({ slug: "notion", name: "Notion", tagline: "Docs and wikis", featured: true }),
    entry({ slug: "stripe", name: "Stripe", tagline: "Payments", category: "data" }),
  ];

  it("puts featured first and sorts the rest alphabetically", () => {
    const result = filterAppCatalog(entries, { query: "", category: null });
    expect(result.map((item) => item.slug)).toEqual(["notion", "alpha", "stripe", "zeta"]);
  });

  it("matches name and tagline case-insensitively", () => {
    expect(filterAppCatalog(entries, { query: "PAYM", category: null })).toHaveLength(1);
    expect(filterAppCatalog(entries, { query: "alpha", category: null })[0]?.slug).toBe("alpha");
  });

  it("excludes entries from other categories", () => {
    const result = filterAppCatalog(entries, { query: "", category: "data" });
    expect(result.map((item) => item.slug)).toEqual(["stripe"]);
  });
});

describe("appsForSurface", () => {
  const apps = [entry({ slug: "linear" }), entry({ slug: "canva", desktopOnly: true })];

  it("leaves out apps whose sign-in needs the desktop app where there is no system browser", () => {
    expect(appsForSurface(apps, { systemBrowser: false }).map((app) => app.slug)).toEqual([
      "linear",
    ]);
  });

  it("offers every app where the system browser is available", () => {
    expect(appsForSurface(apps, { systemBrowser: true })).toEqual(apps);
  });
});

describe("matchAddedServer", () => {
  it("matches by slug", () => {
    const added = server({ slug: "linear", endpoint: "https://elsewhere.example.com/mcp" });
    expect(matchAddedServer(entry(), [server(), added])).toBe(added);
  });

  it("matches by identical endpoint", () => {
    const added = server({ slug: "my-linear", endpoint: "https://mcp.linear.app/mcp" });
    expect(matchAddedServer(entry(), [added])).toBe(added);
  });

  it("returns undefined when nothing matches", () => {
    expect(matchAddedServer(entry(), [server()])).toBeUndefined();
  });
});
