import { describe, expect, it } from "vitest";
import { isFreshMessage, newestCreatedAt } from "./fresh-messages";

const at = (createdAt: string) => ({ createdAt });

describe("newestCreatedAt", () => {
  it("is the latest time in the list, and null for an empty list", () => {
    expect(
      newestCreatedAt([
        at("2026-11-01T10:00:00Z"),
        at("2026-11-01T12:00:00Z"),
        at("2026-11-01T09:00:00Z"),
      ]),
    ).toBe("2026-11-01T12:00:00Z");
    expect(newestCreatedAt([])).toBeNull();
  });
});

describe("isFreshMessage", () => {
  it("is true only for a message newer than everything the chat opened with", () => {
    const opened = "2026-11-01T12:00:00Z";
    expect(isFreshMessage(at("2026-11-01T12:00:01Z"), opened)).toBe(true);
    expect(isFreshMessage(at("2026-11-01T12:00:00Z"), opened)).toBe(false);
    // Earlier messages loaded on scroll are history, not news.
    expect(isFreshMessage(at("2026-10-31T08:00:00Z"), opened)).toBe(false);
  });

  it("is true for every message of a chat that opened empty", () => {
    expect(isFreshMessage(at("2026-11-01T12:00:01Z"), null)).toBe(true);
  });
});
