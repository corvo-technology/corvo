import { describe, expect, it } from "vitest";
import {
  linkWikiTitles,
  parseWikiPage,
  wikiCanonicalTitle,
  wikiKind,
  wikiLinks,
  wikiPath,
  wikiSlug,
  wikiSummary,
  wikiTitle,
  withWikiFront,
} from "./wiki.js";

describe("wiki titles", () => {
  it("compares titles without case, accents or extra spaces", () => {
    expect(wikiSlug("Café  Alpha")).toBe("cafe alpha");
    expect(wikiSlug("cafe alpha")).toBe(wikiSlug("Café  Alpha"));
    expect(wikiSlug(" ... ")).toBe("...");
    expect(wikiSlug("   ")).toBe("");
  });

  it("names a page by the file name a link points to, as Obsidian does", () => {
    expect(wikiTitle("Clients/Alpha Builders.md")).toBe("Alpha Builders");
    expect(wikiTitle("[[Alpha Builders]]")).toBe("Alpha Builders");
    expect(wikiTitle("Alpha Builders|the builders")).toBe("Alpha Builders");
    expect(wikiTitle("  Alpha Builders.MD ")).toBe("Alpha Builders");
  });

  it("turns a title into a file name that file systems accept", () => {
    expect(wikiPath("A/B: C?")).toBe("A-B- C-.md");
    expect(wikiPath("..hidden")).toBe("hidden.md");
    expect(wikiPath("x".repeat(300))).toBe(`${"x".repeat(120)}.md`);
    expect(wikiPath("???")).toBe("---.md");
    expect(wikiPath("   ")).toBe("untitled.md");
  });
});

describe("wikiCanonicalTitle", () => {
  it("names a page the way its file name and every link to it do", () => {
    expect(wikiCanonicalTitle("Clients/Alpha Builders.md")).toBe("Alpha Builders");
    expect(wikiCanonicalTitle("[[Alpha: Builders|them]]")).toBe("Alpha- Builders");
    expect(wikiCanonicalTitle("Plan?")).toBe("Plan-");
    expect(wikiSlug(wikiCanonicalTitle("A: B"))).toBe(wikiSlug(wikiCanonicalTitle("a- b")));
  });
});

describe("wiki page text", () => {
  it("lists the distinct pages a body links to, outside code", () => {
    expect(wikiLinks("See [[A]], [[B|label]], [[a]] and `[[C]]`")).toEqual(["A", "B"]);
    expect(wikiLinks("```\n[[D]]\n```\nand [[Clients/E.md]]")).toEqual(["E"]);
    expect(wikiLinks("no links")).toEqual([]);
  });

  it("sums a page up in its first sentence", () => {
    expect(wikiSummary("# T\n\nOne line. More.")).toBe("One line.");
    expect(wikiSummary("# T\n\nNo full stop here\n\nSecond")).toBe("No full stop here");
    expect(wikiSummary("# Only a heading")).toBe("");
    expect(wikiSummary(`${"word ".repeat(80)}`).length).toBeLessThanOrEqual(160);
    expect(wikiSummary("Met [[Ana|Ana Souza]] about [[Plan]].")).toBe("Met Ana Souza about Plan.");
  });

  it("says what kind a page is: what it states, else its folder, else Other", () => {
    expect(wikiKind("Clients/X.md", {})).toBe("Clients");
    expect(wikiKind("Clients/X.md", { type: "Person" })).toBe("Person");
    expect(wikiKind("X.md", { kind: "Project" })).toBe("Project");
    expect(wikiKind("X.md", {})).toBe("Other");
  });

  it("reads and writes the front matter Obsidian shows as properties", () => {
    const text = withWikiFront(undefined, { type: "Person", tags: "a, b" }, "Body\n\nMore");
    expect(text).toBe("---\ntype: Person\ntags: a, b\n---\nBody\n\nMore");
    expect(parseWikiPage(text)).toEqual({
      meta: { type: "Person", tags: "a, b" },
      body: "Body\n\nMore",
    });
    expect(parseWikiPage("No front matter")).toEqual({ meta: {}, body: "No front matter" });
    expect(parseWikiPage("---\nunterminated\nBody")).toEqual({
      meta: {},
      body: "---\nunterminated\nBody",
    });
    const merged = withWikiFront(text, { type: "Client" }, "New");
    expect(parseWikiPage(merged)).toEqual({
      meta: { type: "Client", tags: "a, b" },
      body: "New",
    });
    expect(withWikiFront(undefined, {}, "Plain")).toBe("Plain");
  });
});

describe("linkWikiTitles", () => {
  const known = (title: string) => title === "Alpha" || title === "Alpha (Beta)";

  it("links pages that exist and leaves the label of those that do not", () => {
    expect(linkWikiTitles("See [[Alpha]] and [[Nope|gone]] and [[Nope]].", known)).toBe(
      "See [Alpha](rook-wiki:Alpha) and gone and Nope.",
    );
  });

  it("keeps a label, and a title with parentheses, from breaking the link", () => {
    expect(linkWikiTitles("[[Alpha|the first]] [[Alpha (Beta)]]", known)).toBe(
      "[the first](rook-wiki:Alpha) [Alpha (Beta)](rook-wiki:Alpha%20%28Beta%29)",
    );
  });

  it("lets the caller choose what a link points to", () => {
    expect(
      linkWikiTitles("See [[Alpha (Beta)]].", known, (title) => `app:${encodeURIComponent(title)}`),
    ).toBe("See [Alpha (Beta)](app:Alpha%20(Beta)).");
  });

  it("leaves code alone", () => {
    expect(linkWikiTitles("`[[Alpha]]` and ```\n[[Alpha]]\n```", known)).toBe(
      "`[[Alpha]]` and ```\n[[Alpha]]\n```",
    );
  });
});
