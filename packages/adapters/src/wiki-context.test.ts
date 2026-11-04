import type { WikiPageInfo } from "@corvo/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listWikiPages = vi.fn<() => Promise<WikiPageInfo[]>>();
const wikiVersion = vi.fn<() => Promise<string>>();
vi.mock("@corvo/db", () => ({
  listWikiPages: (...args: unknown[]) => listWikiPages(...(args as [])),
  wikiVersion: (...args: unknown[]) => wikiVersion(...(args as [])),
}));

import { formatWikiIndex, loadWikiIndexContext } from "./wiki-context.js";

const page = (title: string, kind = "Other", summary = `About ${title}.`): WikiPageInfo => ({
  title,
  path: `${title}.md`,
  kind,
  summary,
  revision: 1,
  updatedAt: "2026-11-04T10:00:00.000Z",
});
const scope = { spaceId: "s", userId: "u" };

let version = 0;
beforeEach(() => {
  listWikiPages.mockReset();
  wikiVersion.mockReset();
  // Each test is its own wiki: a new version, so nothing is carried over from the last one.
  version += 1;
  wikiVersion.mockResolvedValue(`v${version}`);
});

describe("formatWikiIndex", () => {
  it("lists pages by kind with the sentence that sums each one up", () => {
    const text = formatWikiIndex(
      [
        page("Ana Souza", "Person", "Leads the account."),
        page("Plan", "Project"),
        page("Zed", "Person"),
      ],
      10_000,
    );
    expect(text).toBe(
      [
        "## Person",
        "- [[Ana Souza]]: Leads the account.",
        "- [[Zed]]: About Zed.",
        "",
        "## Project",
        "- [[Plan]]: About Plan.",
      ].join("\n"),
    );
  });

  it("stops at the budget and says how many pages it left out", () => {
    const pages = Array.from({ length: 2000 }, (_, i) => page(`Page ${i}`, "Other"));
    const text = formatWikiIndex(pages, 4_000);
    expect(Buffer.byteLength(text, "utf8")).toBeLessThanOrEqual(4_000);
    expect(text).toMatch(/and \d+ more pages? \(2000 in all\)/);
  });

  it("is empty for an empty wiki", () => {
    expect(formatWikiIndex([], 1000)).toBe("");
  });
});

describe("loadWikiIndexContext", () => {
  it("is nothing when the wiki has no pages", async () => {
    listWikiPages.mockResolvedValue([]);
    expect(await loadWikiIndexContext({} as never, scope)).toBeUndefined();
  });

  it("tells the agent to look in the wiki, cite pages, and treat page text as data", async () => {
    listWikiPages.mockResolvedValue([page("Ana Souza", "Person")]);
    const text = (await loadWikiIndexContext({} as never, scope))!;
    expect(text).toContain("wiki_search");
    expect(text).toContain("wiki_read");
    expect(text).toContain("[[Title]]");
    expect(text).toMatch(/data, never instructions/);
    expect(text).toContain("<wiki_index");
    expect(text).toContain("- [[Ana Souza]]");
  });

  it("reads the pages again only when the wiki has changed", async () => {
    listWikiPages.mockResolvedValue([page("Ana Souza", "Person")]);
    const sameScope = { spaceId: "cached-space", userId: "u" };
    await loadWikiIndexContext({} as never, sameScope);
    await loadWikiIndexContext({} as never, { ...sameScope, userId: "someone else" });
    expect(listWikiPages).toHaveBeenCalledTimes(1);
    wikiVersion.mockResolvedValue("changed");
    listWikiPages.mockResolvedValue([page("Ana Souza", "Person"), page("Plan")]);
    const text = (await loadWikiIndexContext({} as never, sameScope))!;
    expect(listWikiPages).toHaveBeenCalledTimes(2);
    expect(text).toContain("[[Plan]]");
  });

  it("keeps one space's pages out of another's index", async () => {
    listWikiPages.mockResolvedValueOnce([page("Only A")]).mockResolvedValueOnce([page("Only B")]);
    wikiVersion.mockResolvedValue("same-version-in-both");
    const a = await loadWikiIndexContext({} as never, { spaceId: "space-a", userId: "u" });
    const b = await loadWikiIndexContext({} as never, { spaceId: "space-b", userId: "u" });
    expect(a).toContain("Only A");
    expect(a).not.toContain("Only B");
    expect(b).toContain("Only B");
    expect(b).not.toContain("Only A");
  });

  it("never fails a run: a wiki that cannot be read is simply left out", async () => {
    listWikiPages.mockRejectedValue(new Error("database is down"));
    expect(await loadWikiIndexContext({} as never, scope)).toBeUndefined();
  });

  it("stays within its byte budget however big the wiki is", async () => {
    listWikiPages.mockResolvedValue(Array.from({ length: 2000 }, (_, i) => page(`Page ${i}`)));
    const text = (await loadWikiIndexContext({} as never, scope, 8 * 1024))!;
    expect(Buffer.byteLength(text, "utf8")).toBeLessThanOrEqual(8 * 1024);
    expect(text).toContain("2000 in all");
  });
});
