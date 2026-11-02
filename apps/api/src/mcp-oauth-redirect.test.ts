import { describe, expect, it } from "vitest";
import { mcpOAuthRedirectAllowed } from "./mcp-oauth-redirect";

const origin = "https://corvo.example";

describe("mcpOAuthRedirectAllowed", () => {
  it("accepts the app's own callback", () => {
    expect(mcpOAuthRedirectAllowed("https://corvo.example/mcp/oauth/callback", origin)).toBe(true);
  });

  it("accepts the desktop's loopback callback on any unprivileged port", () => {
    for (const host of ["127.0.0.1", "localhost", "[::1]"]) {
      expect(mcpOAuthRedirectAllowed(`http://${host}:53123/mcp/oauth/callback`, origin)).toBe(true);
    }
  });

  it("refuses a loopback callback that is not the MCP callback path", () => {
    expect(mcpOAuthRedirectAllowed("http://127.0.0.1:53123/other", origin)).toBe(false);
    expect(mcpOAuthRedirectAllowed("http://127.0.0.1:53123/mcp/oauth/callback/x", origin)).toBe(
      false,
    );
  });

  it("refuses privileged or missing ports, queries, fragments and credentials", () => {
    for (const url of [
      "http://127.0.0.1/mcp/oauth/callback",
      "http://127.0.0.1:80/mcp/oauth/callback",
      "http://127.0.0.1:1023/mcp/oauth/callback",
      "http://127.0.0.1:53123/mcp/oauth/callback?x=1",
      "http://127.0.0.1:53123/mcp/oauth/callback#x",
      "http://user:pw@127.0.0.1:53123/mcp/oauth/callback",
    ]) {
      expect(mcpOAuthRedirectAllowed(url, origin), url).toBe(false);
    }
  });

  it("refuses other hosts, https loopback and other schemes", () => {
    for (const url of [
      "https://evil.example/mcp/oauth/callback",
      "https://127.0.0.1:53123/mcp/oauth/callback",
      "http://192.168.1.5:53123/mcp/oauth/callback",
      "http://localhost.evil.example:53123/mcp/oauth/callback",
      "corvo://mcp/oauth/callback",
      "not a url",
    ]) {
      expect(mcpOAuthRedirectAllowed(url, origin), url).toBe(false);
    }
  });
});
