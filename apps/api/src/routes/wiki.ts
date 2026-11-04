import {
  importSharedMemoryOnce,
  listWikiPages,
  readWikiPage,
  removeWikiPage,
  restoreWikiRevision,
  searchWiki,
  WikiConflictError,
  WikiNotFoundError,
  WikiTitleError,
  wikiHistory,
  writeWikiPage,
} from "@corvo/db";
import { ORPCError } from "@orpc/server";
import type { RouterContext } from "./context.js";

/** What the store refuses, as the procedure's own errors. */
function asRpcError(error: unknown): never {
  if (error instanceof WikiConflictError)
    throw new ORPCError("CONFLICT", { message: error.message });
  if (error instanceof WikiTitleError)
    throw new ORPCError("BAD_REQUEST", { message: error.message });
  if (error instanceof WikiNotFoundError)
    throw new ORPCError("NOT_FOUND", { message: error.message });
  throw error;
}

/**
 * The space's shared wiki. Every member of the space may read and write it, so a procedure names
 * the actor's space and never limits pages to their author.
 */
export function wikiRoutes(ctx: RouterContext) {
  const { deps, authed } = ctx;
  const db = deps.prisma;
  const scopeOf = (actor: { spaceId: string; userId: string }) => ({
    spaceId: actor.spaceId,
    userId: actor.userId,
  });
  const guarded = async <T>(work: () => Promise<T>): Promise<T> => {
    try {
      return await work();
    } catch (error) {
      return asRpcError(error);
    }
  };
  return {
    wiki: {
      index: authed.wiki.index.handler(async ({ context }) => {
        // The first opening brings the person's shared memory in; after that this is a plain list.
        await importSharedMemoryOnce(db, scopeOf(context.actor));
        return listWikiPages(db, scopeOf(context.actor));
      }),
      search: authed.wiki.search.handler(({ context, input }) =>
        searchWiki(db, scopeOf(context.actor), input.query, input.limit),
      ),
      read: authed.wiki.read.handler(({ context, input }) =>
        guarded(async () => {
          const page = await readWikiPage(db, scopeOf(context.actor), input.title);
          if (!page) throw new WikiNotFoundError();
          return page;
        }),
      ),
      write: authed.wiki.write.handler(({ context, input }) =>
        guarded(() => writeWikiPage(db, scopeOf(context.actor), input)),
      ),
      history: authed.wiki.history.handler(({ context, input }) =>
        guarded(() => wikiHistory(db, scopeOf(context.actor), input.title)),
      ),
      restore: authed.wiki.restore.handler(({ context, input }) =>
        guarded(() => restoreWikiRevision(db, scopeOf(context.actor), input.title, input.revision)),
      ),
      remove: authed.wiki.remove.handler(async ({ context, input }) => {
        await removeWikiPage(db, scopeOf(context.actor), input.title);
        return { ok: true as const };
      }),
    },
  };
}
