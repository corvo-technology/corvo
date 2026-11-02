import type { AppCatalogEntry, McpServer } from "@corvo/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({ rpc }));

import { addCatalogApp, mobileAddableApps } from "./app-catalog-connect";

const entry = (overrides: Partial<AppCatalogEntry>): AppCatalogEntry => ({
  slug: "context7",
  name: "Context7",
  tagline: "Up-to-date library documentation",
  category: "coding",
  iconUrl: "https://context7.com/favicon.ico",
  featured: false,
  endpoint: "https://mcp.context7.com/mcp",
  transport: "streamable_http",
  auth: { kind: "none" },
  prompts: [],
  ...overrides,
});

beforeEach(() => rpc.mockReset().mockResolvedValue({ id: "srv_1" }));

describe("mobileAddableApps", () => {
  it("keeps only apps that need no browser sign-in and no key", () => {
    const apps = [
      entry({}),
      entry({ slug: "linear", auth: { kind: "oauth" } }),
      entry({
        slug: "render",
        auth: {
          kind: "key",
          header: "Authorization",
          scheme: "bearer",
          label: "API key",
          hint: "Settings",
          docsUrl: "https://example.com",
        },
      }),
    ];
    expect(mobileAddableApps(apps, []).map((app) => app.slug)).toEqual(["context7"]);
  });

  it("leaves out apps that are already added", () => {
    const added = { slug: "other", endpoint: "https://mcp.context7.com/mcp" } as McpServer;
    expect(mobileAddableApps([entry({})], [added])).toEqual([]);
  });
});

describe("addCatalogApp", () => {
  it("creates the server from the catalog entry", async () => {
    await addCatalogApp(entry({}));
    expect(rpc).toHaveBeenCalledWith(
      "mcp/servers/create",
      expect.objectContaining({ slug: "context7", endpoint: "https://mcp.context7.com/mcp" }),
    );
  });
});
