import { wikiCanonicalTitle, wikiSlug } from "@corvo/core";
import type { PrismaClient } from "./client.js";
import { type WikiScope, writeWikiPage } from "./wiki.js";

/** What a new space's shared memory says before anyone has written in it. */
const SEED = "Preferences and context kept within this space live here.";

/** A document with nothing in it but its heading and the line a new space starts with. */
function isUntouched(content: string): boolean {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .every((line) => !line || line.startsWith("#") || line === SEED);
}

/**
 * Brings the person's shared memory (the documents every one of their agents reads) into the wiki
 * as pages, once. The originals stay where they are. A title the wiki already has is not replaced.
 * A hidden marker page records that it was done, so a page the person deletes later stays deleted.
 * Runs when the wiki is first opened, never in a migration, so a release running beside this one
 * does not meet pages it does not know. Returns how many pages it wrote.
 */
export async function importSharedMemoryOnce(db: PrismaClient, scope: WikiScope): Promise<number> {
  const slug = `.imported-shared-memory-${scope.userId}`;
  const marker = await db.memoryDocument.findFirst({
    where: { spaceId: scope.spaceId, scope: "wiki", slug },
    select: { id: true },
  });
  if (marker) return 0;

  const documents = await db.memoryDocument.findMany({
    where: { spaceId: scope.spaceId, userId: scope.userId, scope: "user", botId: null },
    orderBy: { path: "asc" },
    select: { path: true, content: true },
  });
  let written = 0;
  for (const document of documents) {
    if (isUntouched(document.content)) continue;
    const title = wikiCanonicalTitle(document.path);
    const exists = await db.memoryDocument.findFirst({
      where: { spaceId: scope.spaceId, scope: "wiki", slug: wikiSlug(title) },
      select: { id: true },
    });
    if (exists) continue;
    await writeWikiPage(db, scope, { title, body: document.content });
    written += 1;
  }
  await db.memoryDocument
    .create({
      data: {
        spaceId: scope.spaceId,
        userId: scope.userId,
        botId: null,
        scope: "wiki",
        path: `${slug}.md`,
        slug,
        content: "Shared memory was brought into the wiki.",
      },
    })
    .catch((error: unknown) => {
      // Two first openings ran at once; the other one wrote the marker.
      if ((error as { code?: unknown }).code !== "P2002") throw error;
    });
  return written;
}
