import type { AppCatalogEntry, McpServer } from "@corvo/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
const connectMcpOauth = vi.fn();

vi.mock("./rpc", () => ({
  rpc: { mcp: { servers: { create: (...args: unknown[]) => create(...args) } } },
}));
vi.mock("./mcp-connect", () => ({
  connectMcpOauth: (...args: unknown[]) => connectMcpOauth(...args),
}));

const { connectCatalogApp } = await import("./app-catalog-connect");

const oauthEntry: AppCatalogEntry = {
  slug: "linear",
  name: "Linear",
  tagline: "Triage and update issues",
  category: "coding",
  iconUrl: "https://linear.app/favicon.ico",
  featured: true,
  endpoint: "https://mcp.linear.app/mcp",
  transport: "streamable_http",
  auth: { kind: "oauth" },
  prompts: [],
};
const keyEntry: AppCatalogEntry = {
  ...oauthEntry,
  slug: "render",
  name: "Render",
  endpoint: "https://mcp.render.com/mcp",
  auth: {
    kind: "key",
    header: "Authorization",
    scheme: "bearer",
    label: "API key",
    hint: "Account settings > API keys",
    docsUrl: "https://example.com/key",
  },
};
const created = { id: "srv_1", slug: "linear" } as McpServer;

beforeEach(() => {
  create.mockReset().mockResolvedValue(created);
  connectMcpOauth.mockReset().mockResolvedValue("connected");
});

describe("connectCatalogApp", () => {
  it("creates the server then starts oauth for an oauth entry", async () => {
    const result = await connectCatalogApp(oauthEntry, {});
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "linear", endpoint: "https://mcp.linear.app/mcp" }),
    );
    expect(connectMcpOauth).toHaveBeenCalledWith("srv_1");
    expect(result).toEqual({ server: created, oauth: "connected" });
  });

  it("reuses an existing server and does not call create", async () => {
    const existing = { id: "srv_9", slug: "linear" } as McpServer;
    const result = await connectCatalogApp(oauthEntry, { existing });
    expect(create).not.toHaveBeenCalled();
    expect(connectMcpOauth).toHaveBeenCalledWith("srv_9");
    expect(result.server).toBe(existing);
  });

  it("never starts oauth for a key entry", async () => {
    const result = await connectCatalogApp(keyEntry, { key: "rnd_abc" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { Authorization: "Bearer rnd_abc" } }),
    );
    expect(connectMcpOauth).not.toHaveBeenCalled();
    expect(result.oauth).toBeNull();
  });

  it("never starts oauth for a no-auth entry", async () => {
    const result = await connectCatalogApp({ ...oauthEntry, auth: { kind: "none" } }, {});
    expect(connectMcpOauth).not.toHaveBeenCalled();
    expect(result.oauth).toBeNull();
  });

  it("throws on a blank key before any rpc call", async () => {
    await expect(connectCatalogApp(keyEntry, { key: "  " })).rejects.toThrow("Key required");
    expect(create).not.toHaveBeenCalled();
  });

  it("still returns the created server when oauth is cancelled", async () => {
    connectMcpOauth.mockResolvedValue("cancelled");
    const result = await connectCatalogApp(oauthEntry, {});
    expect(result).toEqual({ server: created, oauth: "cancelled" });
  });
});
