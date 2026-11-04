import type { WikiHit, WikiPage, WikiPageInfo, WikiRevision } from "@corvo/contracts";
import {
  parseWikiPage,
  wikiCanonicalTitle,
  wikiKind,
  wikiLinks,
  wikiPath,
  wikiSlug,
  wikiSummary,
  wikiTitle,
} from "@corvo/core";
import type { PrismaClient } from "./client.js";
import { Prisma } from "./client.js";
import { searchTerms } from "./content-crypto.js";
import { contentEncryptionOf } from "./content-encryption.js";
import { isWriteConflict, withTransactionRetry } from "./transaction-retry.js";

/**
 * The space's shared wiki: memory documents with the scope "wiki", one page per title. Any member
 * of the space reads and writes them, so queries name the space and never the person; `userId` is
 * only the author, kept because it is bound into the page's ciphertext.
 */
export type WikiScope = { spaceId: string; userId: string };

/** The most pages read at once; a page, its links and its backlinks are worked out from them. */
export const WIKI_PAGE_LIMIT = 2000;
const SCOPE = "wiki";
const SNIPPET_BEFORE = 60;
const SNIPPET_AFTER = 100;

export class WikiConflictError extends Error {
  constructor() {
    super("This page changed since it was opened.");
    this.name = "WikiConflictError";
  }
}

export class WikiTitleError extends Error {
  constructor(message = "A page needs a title with a letter or a digit in it.") {
    super(message);
    this.name = "WikiTitleError";
  }
}

export class WikiNotFoundError extends Error {
  constructor() {
    super("There is no such page.");
    this.name = "WikiNotFoundError";
  }
}

type Row = {
  id: string;
  path: string;
  slug: string | null;
  content: string;
  revision: number;
  updatedAt: Date;
};

const SELECT = {
  id: true,
  path: true,
  slug: true,
  content: true,
  revision: true,
  updatedAt: true,
} as const;

/** Pages whose path starts with a dot hold the wiki's own bookkeeping and are never shown. */
const VISIBLE = { NOT: { path: { startsWith: "." } } } as const;

const titleOfRow = (row: Row) => row.path.replace(/\.md$/, "");
const slugOfRow = (row: Row) => row.slug ?? wikiSlug(titleOfRow(row));
const fold = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

function infoOf(row: Row): WikiPageInfo {
  const { meta, body } = parseWikiPage(row.content);
  return {
    title: titleOfRow(row),
    path: row.path,
    kind: wikiKind(row.path, meta),
    summary: wikiSummary(body),
    revision: row.revision,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function linksOf(content: string): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const link of wikiLinks(parseWikiPage(content).body)) {
    const title = wikiCanonicalTitle(link);
    const slug = wikiSlug(title);
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      titles.push(title);
    }
  }
  return titles;
}

function pageOf(rows: Row[], row: Row): WikiPage {
  const byslug = new Map(rows.map((other) => [slugOfRow(other), other]));
  const links = linksOf(row.content);
  const slug = slugOfRow(row);
  return {
    ...infoOf(row),
    body: row.content,
    links: links.map((link) => {
      const found = byslug.get(wikiSlug(link));
      return found ? titleOfRow(found) : link;
    }),
    missing: links.filter((link) => !byslug.has(wikiSlug(link))),
    backlinks: rows
      .filter(
        (other) =>
          other.id !== row.id && linksOf(other.content).some((link) => wikiSlug(link) === slug),
      )
      .map(titleOfRow)
      .sort(),
  };
}

function wikiRows(db: PrismaClient, spaceId: string): Promise<Row[]> {
  return db.memoryDocument.findMany({
    where: { spaceId, scope: SCOPE, ...VISIBLE },
    orderBy: { path: "asc" },
    take: WIKI_PAGE_LIMIT,
    select: SELECT,
  });
}

const slugOfTitle = (title: string) => wikiSlug(wikiCanonicalTitle(title));

/** Every page of the space, by title. */
export async function listWikiPages(db: PrismaClient, scope: WikiScope): Promise<WikiPageInfo[]> {
  return (await wikiRows(db, scope.spaceId)).map(infoOf);
}

export async function readWikiPage(
  db: PrismaClient,
  scope: WikiScope,
  title: string,
): Promise<WikiPage | undefined> {
  const slug = slugOfTitle(title);
  const rows = await wikiRows(db, scope.spaceId);
  // The rows read at once are capped, so a page past the cap is looked up by its own slug; the
  // cap only limits which pages its links and citations are worked out against.
  const row =
    rows.find((candidate) => slugOfRow(candidate) === slug) ??
    (await db.memoryDocument.findFirst({
      where: { spaceId: scope.spaceId, scope: SCOPE, slug, ...VISIBLE },
      select: SELECT,
    })) ??
    undefined;
  if (!row) return undefined;
  return pageOf(rows.some((other) => other.id === row.id) ? rows : [...rows, row], row);
}

function snippetOf(content: string, terms: string[]): string {
  const { body } = parseWikiPage(content);
  const lower = body.toLowerCase();
  const at = terms.map((term) => lower.indexOf(term)).find((index) => index >= 0) ?? 0;
  const start = Math.max(0, at - SNIPPET_BEFORE);
  const piece = body
    .slice(start, at + SNIPPET_AFTER)
    .replace(/\s+/g, " ")
    .trim();
  return `${start > 0 ? "…" : ""}${piece}${at + SNIPPET_AFTER < body.length ? "…" : ""}`;
}

/**
 * Pages whose text has every word of the query (a word may be the start of one). Encrypted pages
 * are found through keyed word tokens and then checked against their real text, since a token can
 * collide; pages with no tokens (written while encryption was off) are read and checked directly.
 */
export async function searchWiki(
  db: PrismaClient,
  scope: WikiScope,
  query: string,
  limit = 8,
): Promise<WikiHit[]> {
  const terms = searchTerms(query).map(fold);
  if (!terms.length) return [];
  const lists = (
    (await contentEncryptionOf(db)?.wikiSearchTokens(scope.spaceId, query)) ?? []
  ).filter((tokens) => tokens.length);
  const base = { spaceId: scope.spaceId, scope: SCOPE, ...VISIBLE };
  const candidates: Row[] = lists.length
    ? [
        ...(await db.memoryDocument.findMany({
          where: {
            ...base,
            OR: lists.map((tokens) => ({ searchTokens: { hasEvery: tokens } })),
          },
          take: WIKI_PAGE_LIMIT,
          select: SELECT,
        })),
        ...(await db.memoryDocument.findMany({
          where: { ...base, searchTokens: { isEmpty: true } },
          take: WIKI_PAGE_LIMIT,
          select: SELECT,
        })),
      ]
    : await wikiRows(db, scope.spaceId);
  const seen = new Set<string>();
  const scored: Array<{ row: Row; score: number }> = [];
  for (const row of candidates) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const title = fold(titleOfRow(row));
    const text = fold(parseWikiPage(row.content).body);
    if (!terms.every((term) => title.includes(term) || text.includes(term))) continue;
    const inTitle = terms.filter((term) => title.includes(term)).length;
    const occurrences = terms.reduce((sum, term) => sum + text.split(term).length - 1, 0);
    scored.push({ row, score: inTitle * 1000 + Math.min(occurrences, 999) });
  }
  scored.sort((a, b) => b.score - a.score || b.row.updatedAt.getTime() - a.row.updatedAt.getTime());
  return scored.slice(0, limit).map(({ row }) => ({
    title: titleOfRow(row),
    kind: infoOf(row).kind,
    snippet: snippetOf(row.content, terms),
  }));
}

export type WikiWrite = {
  title: string;
  body: string;
  /** The revision the writer saw (0: the title must be free); refused when the page has moved on. */
  expectedRevision?: number;
  sourceRunId?: string;
  sourceThreadId?: string;
};

/**
 * Writes a page, new or not, and keeps the text it replaces as a revision. A page is found by its
 * slug, so `Café` and `cafe` are one title; writing it under another spelling than the page has
 * is refused instead of renaming it.
 */
export async function writeWikiPage(
  db: PrismaClient,
  scope: WikiScope,
  input: WikiWrite,
): Promise<WikiPage> {
  if (!/[\p{L}\p{N}]/u.test(wikiTitle(input.title))) throw new WikiTitleError();
  const title = wikiCanonicalTitle(input.title);
  const slug = wikiSlug(title);
  const path = wikiPath(title);
  try {
    await withTransactionRetry(() =>
      db.$transaction(
        async (tx) => {
          const existing = await tx.memoryDocument.findFirst({
            where: { spaceId: scope.spaceId, scope: SCOPE, slug },
            select: { id: true, path: true, revision: true },
          });
          if (existing && existing.path !== path)
            throw new WikiTitleError(
              `A page called "${existing.path.replace(/\.md$/, "")}" exists.`,
            );
          // 0 means the writer expects a free title; any other number, the revision it opened.
          if (
            input.expectedRevision === 0
              ? existing
              : input.expectedRevision !== undefined &&
                existing?.revision !== input.expectedRevision
          )
            throw new WikiConflictError();
          const doc = existing
            ? await tx.memoryDocument.update({
                where: { id: existing.id },
                // The scope and path are named again so the page's word tokens are made from them.
                data: { scope: SCOPE, path, content: input.body, revision: existing.revision + 1 },
                select: { id: true, revision: true },
              })
            : await tx.memoryDocument.create({
                data: {
                  spaceId: scope.spaceId,
                  userId: scope.userId,
                  botId: null,
                  scope: SCOPE,
                  path,
                  slug,
                  content: input.body,
                },
                select: { id: true, revision: true },
              });
          await tx.memoryRevision.create({
            data: {
              documentId: doc.id,
              revision: doc.revision,
              content: input.body,
              sourceRunId: input.sourceRunId,
              sourceThreadId: input.sourceThreadId,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  } catch (error) {
    // Two writers collided (the same new title, or the same page) and this one kept losing.
    if ((error as { code?: unknown }).code === "P2002" || isWriteConflict(error))
      throw new WikiConflictError();
    throw error;
  }
  return (await readWikiPage(db, scope, title))!;
}

async function documentOf(db: PrismaClient, scope: WikiScope, title: string) {
  const doc = await db.memoryDocument.findFirst({
    where: { spaceId: scope.spaceId, scope: SCOPE, slug: slugOfTitle(title) },
    select: { id: true, revision: true },
  });
  if (!doc) throw new WikiNotFoundError();
  return doc;
}

/** The newest revisions of a page that are read: each one is decrypted to report its size. */
export const WIKI_HISTORY_LIMIT = 100;

/**
 * A short string that changes whenever a page is added, edited or removed, worked out without
 * reading or decrypting any page. Callers keep what they built from the pages until it changes.
 */
export async function wikiVersion(db: PrismaClient, scope: WikiScope): Promise<string> {
  const { _count, _max } = await db.memoryDocument.aggregate({
    where: { spaceId: scope.spaceId, scope: SCOPE, ...VISIBLE },
    _count: { _all: true },
    _max: { updatedAt: true },
  });
  return `${_count._all}:${_max.updatedAt?.getTime() ?? 0}`;
}

/** The newest revisions of a page, newest first. */
export async function wikiHistory(
  db: PrismaClient,
  scope: WikiScope,
  title: string,
): Promise<WikiRevision[]> {
  const doc = await documentOf(db, scope, title);
  const revisions = await db.memoryRevision.findMany({
    where: { documentId: doc.id },
    orderBy: { revision: "desc" },
    take: WIKI_HISTORY_LIMIT,
    select: { revision: true, createdAt: true, content: true },
  });
  return revisions.map((revision) => ({
    revision: revision.revision,
    at: revision.createdAt.toISOString(),
    bytes: Buffer.byteLength(revision.content, "utf8"),
  }));
}

/** Writes an earlier revision's text as the page's newest revision. */
export async function restoreWikiRevision(
  db: PrismaClient,
  scope: WikiScope,
  title: string,
  revision: number,
): Promise<WikiPage> {
  const doc = await documentOf(db, scope, title);
  const old = await db.memoryRevision.findUnique({
    where: { documentId_revision: { documentId: doc.id, revision } },
    select: { content: true },
  });
  if (!old) throw new WikiNotFoundError();
  const page = await readWikiPage(db, scope, title);
  return writeWikiPage(db, scope, { title: page!.title, body: old.content });
}

/** Deletes a page and its history. False when there was none. */
export async function removeWikiPage(
  db: PrismaClient,
  scope: WikiScope,
  title: string,
): Promise<boolean> {
  const { count } = await db.memoryDocument.deleteMany({
    where: { spaceId: scope.spaceId, scope: SCOPE, slug: slugOfTitle(title) },
  });
  return count > 0;
}
