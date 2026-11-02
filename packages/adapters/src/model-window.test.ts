import { describe, expect, it } from "vitest";
import { modelContextWindow } from "./model-window.js";

describe("modelContextWindow", () => {
  it("reads the window of a catalog model", () => {
    expect(modelContextWindow("anthropic", "claude-sonnet-5-5")).toBeGreaterThan(8_000);
  });

  it("is null for a model the catalog does not have", () => {
    expect(modelContextWindow("anthropic", "not-a-real-model")).toBeNull();
    expect(modelContextWindow("anthropic", "")).toBeNull();
  });
});
