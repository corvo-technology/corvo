import { describe, expect, it } from "vitest";
import {
  WIKI_BODY_MAX,
  WikiHitSchema,
  WikiPageInfoSchema,
  WikiPageSchema,
  WikiRevisionSchema,
  WikiTitleSchema,
  WikiWriteInputSchema,
} from "./wiki.js";

const info = {
  title: "Alpha Builders",
  path: "Alpha Builders.md",
  kind: "Client",
  summary: "A construction client.",
  revision: 2,
  updatedAt: "2026-11-04T10:00:00.000Z",
};

describe("wiki contracts", () => {
  it("describes a page with what it links to and what cites it", () => {
    const page = {
      ...info,
      body: "See [[Ana]] and [[Nobody]].",
      links: ["Ana", "Nobody"],
      missing: ["Nobody"],
      backlinks: ["Plan"],
    };
    expect(WikiPageSchema.parse(page)).toEqual(page);
    expect(WikiPageInfoSchema.parse(info)).toEqual(info);
    expect(WikiHitSchema.parse({ title: "A", kind: "Other", snippet: "…" })).toBeTruthy();
    expect(
      WikiRevisionSchema.parse({ revision: 1, at: "2026-11-04T10:00:00.000Z", bytes: 12 }),
    ).toBeTruthy();
  });

  it("needs a title with a letter or a digit in it", () => {
    expect(WikiTitleSchema.safeParse("").success).toBe(false);
    expect(WikiTitleSchema.safeParse("   ").success).toBe(false);
    expect(WikiTitleSchema.safeParse("?!...").success).toBe(false);
    expect(WikiTitleSchema.safeParse("x".repeat(121)).success).toBe(false);
    expect(WikiTitleSchema.parse("  Café 2  ")).toBe("Café 2");
  });

  it("limits what can be written", () => {
    expect(WikiWriteInputSchema.safeParse({ title: "A", body: "text" }).success).toBe(true);
    expect(
      WikiWriteInputSchema.safeParse({ title: "A", body: "x".repeat(WIKI_BODY_MAX + 1) }).success,
    ).toBe(false);
    expect(WikiWriteInputSchema.safeParse({ title: "!!", body: "text" }).success).toBe(false);
    // 0 means "this page must not exist yet", the way a new page is written; negatives are nonsense.
    expect(
      WikiWriteInputSchema.safeParse({ title: "A", body: "t", expectedRevision: 0 }).success,
    ).toBe(true);
    expect(
      WikiWriteInputSchema.safeParse({ title: "A", body: "t", expectedRevision: -1 }).success,
    ).toBe(false);
    expect(WIKI_BODY_MAX).toBe(200_000);
  });
});
