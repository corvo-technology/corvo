import { describe, expect, it, vi } from "vitest";
import { enterLocalOwner } from "./local-entry.js";

const TOKEN = "a".repeat(64);

describe("enterLocalOwner", () => {
  it("asks the local engine for a session with the private token in a header", async () => {
    const request = vi.fn(async () => new Response("{}", { status: 200 }));
    await enterLocalOwner({ origin: "http://127.0.0.1:45173", token: TOKEN }, request);
    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:45173/api/local/enter");
    expect(url).not.toContain(TOKEN);
    expect((init.headers as Record<string, string>)["x-corvo-local-settings-token"]).toBe(TOKEN);
    expect(init.credentials).toBe("include");
    expect(init.redirect).toBe("error");
  });

  it("never sends the token to a server that is not on this computer", async () => {
    const request = vi.fn();
    await expect(
      enterLocalOwner({ origin: "https://app.example.com", token: TOKEN }, request),
    ).rejects.toThrow("Invalid local server address");
    expect(request).not.toHaveBeenCalled();
  });

  it("fails when the engine refuses", async () => {
    const request = vi.fn(async () => new Response("{}", { status: 401 }));
    await expect(
      enterLocalOwner({ origin: "http://127.0.0.1:45173", token: TOKEN }, request),
    ).rejects.toThrow("Could not open the local server");
  });
});
