import type { WikiPageInfo } from "@corvo/contracts";
import { linkWikiTitles, parseWikiPage, wikiMentionHref, wikiSlug } from "@corvo/core";
import { rpc } from "./api";

export type WikiGroup = { kind: string; pages: WikiPageInfo[] };

/** The pages by kind, the kinds and the titles in order. */
export function groupWikiPages(pages: readonly WikiPageInfo[]): WikiGroup[] {
  const byKind = new Map<string, WikiPageInfo[]>();
  for (const page of pages) byKind.set(page.kind, [...(byKind.get(page.kind) ?? []), page]);
  return [...byKind.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, list]) => ({
      kind,
      pages: [...list].sort((a, b) => a.title.localeCompare(b.title)),
    }));
}

/**
 * A page's text as Markdown to show: front matter left out, a [[link]] to a page that exists
 * drawn as a mention the screen can follow, and one to a page that does not as its plain label.
 */
export function wikiDisplayBody(body: string, pages: readonly WikiPageInfo[]): string {
  const known = new Set(pages.map((page) => wikiSlug(page.title)));
  return linkWikiTitles(
    parseWikiPage(body).body,
    (title) => known.has(wikiSlug(title)),
    wikiMentionHref,
  );
}

export function listWikiPages() {
  return rpc("wiki/index");
}

export function readWikiPage(title: string) {
  return rpc("wiki/read", { title });
}
