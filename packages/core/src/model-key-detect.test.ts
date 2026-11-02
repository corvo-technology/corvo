import { describe, expect, it } from "vitest";
import { detectProviderFromKey } from "./model-key-detect.js";

describe("detectProviderFromKey", () => {
  it("recognises each provider by its key prefix", () => {
    expect(detectProviderFromKey("sk-or-v1-abc123def456")).toBe("openrouter");
    expect(detectProviderFromKey("sk-ant-api03-abc123def456")).toBe("anthropic");
    expect(detectProviderFromKey("AIzaSyAbc123def456ghi789")).toBe("google");
    expect(detectProviderFromKey("sk-proj-abc123def456")).toBe("openai");
    expect(detectProviderFromKey("sk-abc123def456ghi789")).toBe("openai");
    expect(detectProviderFromKey("gsk_abc123def456ghi789")).toBe("groq");
    expect(detectProviderFromKey("xai-abc123def456ghi789")).toBe("xai");
  });

  it("prefers the more specific prefix", () => {
    expect(detectProviderFromKey("sk-or-v1-abc")).toBe("openrouter");
    expect(detectProviderFromKey("sk-ant-abc")).toBe("anthropic");
  });

  it("ignores surrounding whitespace and returns null when nothing matches", () => {
    expect(detectProviderFromKey("  sk-or-v1-abc123  ")).toBe("openrouter");
    expect(detectProviderFromKey("")).toBeNull();
    expect(detectProviderFromKey("hello")).toBeNull();
    expect(detectProviderFromKey("sk-")).toBeNull();
  });
});
