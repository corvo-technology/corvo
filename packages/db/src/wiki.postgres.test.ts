import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runAsSystem } from "./row-security.js";
import {
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
} from "./wiki.js";
import { wikiTestFixture } from "./wiki-test-fixture.js";

const describePostgres =
  process.env.VERIFY_DATABASE && process.env.DATABASE_URL ? describe.sequential : describe.skip;

describePostgres("wiki storage (PostgreSQL)", () => {
  let fx: Awaited<ReturnType<typeof wikiTestFixture>>;
  beforeAll(async () => {
    fx = await wikiTestFixture();
  });
  afterAll(() => fx?.close());

  const system = <T>(work: () => Promise<T>) => runAsSystem("test fixture", work);
  const mine = () => ({ spaceId: fx.spaceId, userId: fx.userId });
  const colleague = () => ({ spaceId: fx.spaceId, userId: fx.otherUserId });
  const elsewhere = () => ({ spaceId: fx.otherSpaceId, userId: fx.userId });
  const write = (title: string, body: string, extra: object = {}) =>
    writeWikiPage(fx.prisma, mine(), { title, body, ...extra });

  it("writes a page and reads it back with what it links to and what is missing", () =>
    system(async () => {
      await write("Ana Souza", "Ana leads the account.");
      const page = await write(
        "Plan",
        "Owner: [[Ana Souza]]. Waiting on [[Budget]] and [[ana souza|Ana]].",
      );
      expect(page.title).toBe("Plan");
      expect(page.revision).toBe(1);
      expect(page.links).toEqual(["Ana Souza", "Budget"]);
      expect(page.missing).toEqual(["Budget"]);
      const read = await readWikiPage(fx.prisma, mine(), "plan");
      expect(read?.body).toContain("Owner:");
      expect(await readWikiPage(fx.prisma, mine(), "Nothing here")).toBeUndefined();
    }));

  it("lets another member of the space read it, and keeps other spaces out", () =>
    system(async () => {
      await write("Shared Note", "Visible to the space.");
      expect((await readWikiPage(fx.prisma, colleague(), "Shared Note"))?.body).toBe(
        "Visible to the space.",
      );
      expect(await readWikiPage(fx.prisma, elsewhere(), "Shared Note")).toBeUndefined();
      expect((await listWikiPages(fx.prisma, elsewhere())).map((p) => p.title)).not.toContain(
        "Shared Note",
      );
    }));

  it("refuses a second spelling of a title that exists, and leaves one page", () =>
    system(async () => {
      await write("Café", "first");
      await expect(write("cafe", "second")).rejects.toBeInstanceOf(WikiTitleError);
      const rows = await fx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM memory_documents WHERE "spaceId" = $1 AND scope = 'wiki' AND slug = 'cafe'`,
        [fx.spaceId],
      );
      expect(rows[0]!.n).toBe(1);
      expect((await readWikiPage(fx.prisma, mine(), "CAFE"))?.body).toBe("first");
    }));

  it("matches a link to a page by its slug, not its spelling", () =>
    system(async () => {
      await write("Brasília", "capital");
      const page = await write("Trip", "Going to [[brasilia]].");
      expect(page.missing).toEqual([]);
    }));

  it("names a page by its file name, with no folder or .md", () =>
    system(async () => {
      const page = await write("Clients/Alpha Builders.md", "A client.");
      expect(page.title).toBe("Alpha Builders");
      const linked = await write("Intro", "See [[Clients/Alpha Builders.md]].");
      expect(linked.missing).toEqual([]);
    }));

  it("refuses a save made from an old revision and keeps the newer text", () =>
    system(async () => {
      await write("Contested", "one");
      const second = await write("Contested", "two", { expectedRevision: 1 });
      expect(second.revision).toBe(2);
      await expect(write("Contested", "stale", { expectedRevision: 1 })).rejects.toBeInstanceOf(
        WikiConflictError,
      );
      expect((await readWikiPage(fx.prisma, mine(), "Contested"))?.body).toBe("two");
    }));

  it("lets two people write the same new page at once without losing it or failing", () =>
    system(async () => {
      const results = await Promise.allSettled(
        ["one", "two", "three", "four"].map((body) => write("Race", body)),
      );
      for (const result of results)
        if (result.status === "rejected") expect(result.reason).toBeInstanceOf(WikiConflictError);
      expect(results.some((result) => result.status === "fulfilled")).toBe(true);
      const rows = await fx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM memory_documents WHERE "spaceId" = $1 AND scope = 'wiki' AND slug = 'race'`,
        [fx.spaceId],
      );
      expect(rows[0]!.n).toBe(1);
      const page = await readWikiPage(fx.prisma, mine(), "Race");
      expect(["one", "two", "three", "four"]).toContain(page?.body);
    }));

  it("writes a new page only if the title is free, when asked to", () =>
    system(async () => {
      const created = await write("Fresh", "mine", { expectedRevision: 0 });
      expect(created.revision).toBe(1);
      await expect(write("Fresh", "theirs", { expectedRevision: 0 })).rejects.toBeInstanceOf(
        WikiConflictError,
      );
      await expect(write("fresh", "theirs", { expectedRevision: 0 })).rejects.toBeInstanceOf(
        WikiTitleError,
      );
      expect((await readWikiPage(fx.prisma, mine(), "Fresh"))?.body).toBe("mine");
    }));

  it("still reads a page when the wiki has more pages than are read at once", () =>
    system(async () => {
      const bulk = `${fx.spaceId}-bulk`;
      await fx.prisma.space.create({
        data: { id: bulk, organizationId: fx.organizationId, name: "Bulk" },
      });
      await fx.query(
        `INSERT INTO memory_documents (id, "spaceId", "userId", scope, path, slug, content, revision, "createdAt", "updatedAt")
         SELECT 'bulk-' || g, $1, $2, 'wiki', 'P' || lpad(g::text, 5, '0') || '.md', 'p' || lpad(g::text, 5, '0'), 'plain body', 1, now(), now()
         FROM generate_series(1, 2001) g`,
        [bulk, fx.userId],
      );
      const scope = { spaceId: bulk, userId: fx.userId };
      await writeWikiPage(fx.prisma, scope, {
        title: "Zzz Last",
        body: "Sorts after every other page.",
      });
      const page = await readWikiPage(fx.prisma, scope, "zzz last");
      expect(page?.title).toBe("Zzz Last");
      expect(page?.body).toContain("Sorts after");
      expect((await restoreWikiRevision(fx.prisma, scope, "Zzz Last", 1)).title).toBe("Zzz Last");
    }));

  it("finds a page by a word in its text, by a prefix, and by its title", () =>
    system(async () => {
      await write("Launch", "The marigold campaign starts in spring.");
      await write("Budget review", "Numbers only.");
      expect((await searchWiki(fx.prisma, mine(), "marigold")).map((h) => h.title)).toEqual([
        "Launch",
      ]);
      expect((await searchWiki(fx.prisma, mine(), "mar")).map((h) => h.title)).toContain("Launch");
      expect((await searchWiki(fx.prisma, mine(), "budget"))[0]?.title).toBe("Budget review");
      expect(await searchWiki(fx.prisma, mine(), "marigold zzzzzz")).toEqual([]);
      expect(await searchWiki(fx.prisma, elsewhere(), "marigold")).toEqual([]);
      const [hit] = await searchWiki(fx.prisma, mine(), "marigold");
      expect(hit?.snippet).toContain("marigold");
    }));

  it("still finds a page whose tokens are missing, as one written with encryption off", () =>
    system(async () => {
      const page = await write("Untokened", "The zephyr protocol.");
      await fx.query(
        `UPDATE memory_documents SET "searchTokens" = '{}' WHERE "spaceId" = $1 AND slug = 'untokened'`,
        [fx.spaceId],
      );
      expect(page.title).toBe("Untokened");
      expect((await searchWiki(fx.prisma, mine(), "zephyr")).map((h) => h.title)).toEqual([
        "Untokened",
      ]);
    }));

  it("lists the pages that cite a page", () =>
    system(async () => {
      await write("Hub", "The hub.");
      await write("Spoke A", "Part of [[Hub]].");
      await write("Spoke B", "Also [[hub]].");
      expect((await readWikiPage(fx.prisma, mine(), "Hub"))?.backlinks.sort()).toEqual([
        "Spoke A",
        "Spoke B",
      ]);
    }));

  it("keeps every revision, and restoring one writes it as a new revision", () =>
    system(async () => {
      await write("Versions", "v1", { sourceRunId: "run-1" });
      await write("Versions", "v2");
      const history = await wikiHistory(fx.prisma, mine(), "Versions");
      expect(history.map((r) => r.revision)).toEqual([2, 1]);
      expect(history[1]!.bytes).toBe(2);
      const restored = await restoreWikiRevision(fx.prisma, mine(), "Versions", 1);
      expect(restored.body).toBe("v1");
      expect(restored.revision).toBe(3);
      const rows = await fx.query<{ run: string | null }>(
        `SELECT r."sourceRunId" AS run FROM memory_revisions r JOIN memory_documents d ON d.id = r."documentId" WHERE d."spaceId" = $1 AND d.slug = 'versions' AND r.revision = 1`,
        [fx.spaceId],
      );
      expect(rows[0]!.run).toBe("run-1");
      await expect(restoreWikiRevision(fx.prisma, mine(), "Versions", 99)).rejects.toBeInstanceOf(
        WikiNotFoundError,
      );
    }));

  it("lists only wiki pages, and none of the hidden ones", () =>
    system(async () => {
      await fx.prisma.memoryDocument.create({
        data: {
          spaceId: fx.spaceId,
          userId: fx.userId,
          scope: "user",
          path: "Ordinary Memory.md",
          content: "not a page",
        },
      });
      await fx.prisma.memoryDocument.create({
        data: {
          spaceId: fx.spaceId,
          userId: fx.userId,
          scope: "wiki",
          path: ".marker.md",
          slug: ".marker",
          content: "hidden",
        },
      });
      const titles = (await listWikiPages(fx.prisma, mine())).map((p) => p.title);
      expect(titles).toContain("Plan");
      expect(titles).not.toContain("Ordinary Memory");
      expect(titles.some((t) => t.startsWith("."))).toBe(false);
    }));

  it("removes a page", () =>
    system(async () => {
      await write("Short lived", "bye");
      expect(await removeWikiPage(fx.prisma, mine(), "short lived")).toBe(true);
      expect(await readWikiPage(fx.prisma, mine(), "Short lived")).toBeUndefined();
      expect(await removeWikiPage(fx.prisma, mine(), "Short lived")).toBe(false);
    }));

  it("summarizes a page and gives it a kind from its front matter", () =>
    system(async () => {
      await write("Typed", "---\ntype: Person\n---\nShe runs finance. Then more.");
      const info = (await listWikiPages(fx.prisma, mine())).find((p) => p.title === "Typed");
      expect(info?.kind).toBe("Person");
      expect(info?.summary).toBe("She runs finance.");
    }));

  it("refuses a title with nothing a page can be called", () =>
    system(async () => {
      await expect(write("...", "x")).rejects.toBeInstanceOf(WikiTitleError);
    }));
});
