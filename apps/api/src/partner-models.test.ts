import { describe, expect, it } from "vitest";
import { partnerModelChangeRefused } from "./partner-models.js";

const existing = { modelProvider: "openrouter", modelId: "a/model" };

describe("partnerModelChangeRefused", () => {
  it("refuses a different model for a customer whose partner fixes the model", () => {
    expect(
      partnerModelChangeRefused("fixed", existing, { modelProvider: "openrouter", modelId: "b/x" }),
    ).toBe(true);
    expect(partnerModelChangeRefused("fixed", existing, { modelProvider: null })).toBe(true);
  });

  it("lets a save through that leaves the model as it is, or does not name one", () => {
    expect(partnerModelChangeRefused("fixed", existing, {})).toBe(false);
    expect(
      partnerModelChangeRefused("fixed", existing, {
        modelProvider: "openrouter",
        modelId: "a/model",
      }),
    ).toBe(false);
    expect(
      partnerModelChangeRefused(
        "fixed",
        { modelProvider: null, modelId: null },
        {
          modelProvider: null,
          modelId: null,
        },
      ),
    ).toBe(false);
  });

  it("never refuses anyone else", () => {
    expect(partnerModelChangeRefused(null, existing, { modelProvider: "x", modelId: "y" })).toBe(
      false,
    );
    expect(
      partnerModelChangeRefused("choose", existing, { modelProvider: "x", modelId: "y" }),
    ).toBe(false);
  });
});
