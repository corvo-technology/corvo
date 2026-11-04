import { wikiCanonicalTitle } from "@corvo/core";
import type { PrismaClient, ThreadEvents } from "@corvo/db";
import { createWikiChange, getWikiSettings, readWikiPage } from "@corvo/db";
import { postWikiChangeCard } from "./wiki-curator-run.js";

type Thread = Parameters<typeof postWikiChangeCard>[1] & { spaceId: string; userId: string };

/**
 * An agent's request to keep a page, as the wiki handles it: a new page is written at once, text
 * for an existing page is added to it and waits for the owner's approval unless the Space lets
 * edits in, and the conversation shows what was kept. The agent never writes a page on its own authority.
 */
export async function keepNoteInWiki(
  deps: { prisma: PrismaClient; events: ThreadEvents },
  input: { thread: Thread; botName: string; path: string; content: string },
): Promise<
  | { ok: true; status: "kept" | "waiting for approval" | "unchanged"; page: string }
  | { error: string }
> {
  if (!/[\p{L}\p{N}]/u.test(input.path)) {
    return { error: "path must name a page with a letter or a digit in it" };
  }
  const page = wikiCanonicalTitle(input.path);
  const scope = { spaceId: input.thread.spaceId, userId: input.thread.userId };
  const current = await readWikiPage(deps.prisma, scope, page);
  if (current?.body === input.content) return { ok: true, status: "unchanged", page };
  const settings = await getWikiSettings(deps.prisma, scope.spaceId);
  const change = await createWikiChange(deps.prisma, scope, {
    source: {
      origin: "note",
      title: `Saved by ${input.botName}`,
      text: input.content,
      threadId: input.thread.id,
    },
    // Text for an existing page is added to it, never put in its place: the agent's copy of the page
    // may be older than the page. When it sent the page as it now stands with more on the end, only
    // the end is added.
    ops: current
      ? [
          {
            op: "append",
            page,
            text: (input.content.startsWith(current.body)
              ? input.content.slice(current.body.length)
              : input.content
            ).trim(),
          },
        ]
      : [{ op: "create", page, body: input.content }],
    reason: `Saved by ${input.botName}`,
    anchor: { threadId: input.thread.id },
    edits: settings.edits,
  });
  if (!change) return { ok: true, status: "unchanged", page };
  await postWikiChangeCard(deps, input.thread, change, input.thread.botId ?? undefined);
  return {
    ok: true,
    status: change.state === "applied" ? "kept" : "waiting for approval",
    page,
  };
}
