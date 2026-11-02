import { describe, expect, it } from "vitest";
import { isBlockedAuthPath } from "./index.js";
import { localTokenMatches } from "./local-entry.js";

describe("localTokenMatches", () => {
  it("accepts only the exact token", () => {
    const token = "a".repeat(64);
    expect(localTokenMatches(token, token)).toBe(true);
    expect(localTokenMatches("b".repeat(64), token)).toBe(false);
    expect(localTokenMatches(token.slice(1), token)).toBe(false);
  });

  it("refuses when either side is empty, so an unset token opens nothing", () => {
    expect(localTokenMatches("", "")).toBe(false);
    expect(localTokenMatches("a".repeat(64), "")).toBe(false);
    expect(localTokenMatches("", "a".repeat(64))).toBe(false);
  });
});

describe("the public auth handler", () => {
  it("does not serve the local entry", () => {
    expect(isBlockedAuthPath("/local/enter")).toBe(true);
  });
});
