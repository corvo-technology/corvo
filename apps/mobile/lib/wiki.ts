import type { WikiChangeState, WikiPageInfo } from "@corvo/contracts";
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

/** What the curator proposed or kept; `["pending"]` is what waits for a person. */
export function listWikiChanges(state?: WikiChangeState[]) {
  return rpc("wiki/changes/list", { state });
}

export function getWikiChange(changeId: string) {
  return rpc("wiki/changes/get", { changeId });
}

export function decideWikiChange(changeId: string, decision: "apply" | "refuse" | "undo") {
  return rpc("wiki/changes/decide", { changeId, decision });
}

/** Asks the wiki to keep one message of a chat with an agent or of a channel. */
export function keepMessageInWiki(target: { botId?: string; groupId?: string }, messageId: string) {
  return rpc("wiki/keep", { ...target, messageId });
}
