import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runAsSystem } from "./row-security.js";
import { listWikiPages, readWikiPage, removeWikiPage, writeWikiPage } from "./wiki.js";
import { importSharedMemoryOnce } from "./wiki-import.js";
import { wikiTestFixture } from "./wiki-test-fixture.js";

const describePostgres =
  process.env.VERIFY_DATABASE && process.env.DATABASE_URL ? describe.sequential : describe.skip;

describePostgres("bringing shared memory into the wiki (PostgreSQL)", () => {
  let fx: Awaited<ReturnType<typeof wikiTestFixture>>;
  beforeAll(async () => {
    fx = await wikiTestFixture();
  });
  afterAll(() => fx?.close());

  const system = <T>(work: () => Promise<T>) => runAsSystem("test fixture", work);
  const mine = () => ({ spaceId: fx.spaceId, userId: fx.userId });
  const colleague = () => ({ spaceId: fx.spaceId, userId: fx.otherUserId });
  const memory = (userId: string, path: string, content: string, scope = "user") =>
    fx.prisma.memoryDocument.create({
      data: { spaceId: fx.spaceId, userId, scope, path, content, botId: null },
    });

  it("copies the person's shared memory as pages and leaves the originals", () =>
    system(async () => {
      await memory(fx.userId, "Rules.md", "Always answer in Portuguese.");
      await memory(fx.userId, "MEMORY.md", "# Space memory\n\n");
      await memory(
        fx.userId,
        "Seed.md",
        "# Space memory\n\nPreferences and context kept within this space live here.\n",
      );
      await memory(fx.userId, "Empty.md", "   \n");
      expect(await importSharedMemoryOnce(fx.prisma, mine())).toBe(1);
      expect((await readWikiPage(fx.prisma, mine(), "Rules"))?.body).toBe(
        "Always answer in Portuguese.",
      );
      expect((await listWikiPages(fx.prisma, mine())).map((p) => p.title)).toEqual(["Rules"]);
      const originals = await fx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM memory_documents WHERE "spaceId" = $1 AND "userId" = $2 AND scope = 'user'`,
        [fx.spaceId, fx.userId],
      );
      expect(originals[0]!.n).toBe(4);
    }));

  it("does it once, and a page deleted afterwards does not come back", () =>
    system(async () => {
      expect(await importSharedMemoryOnce(fx.prisma, mine())).toBe(0);
      expect(await removeWikiPage(fx.prisma, mine(), "Rules")).toBe(true);
      expect(await importSharedMemoryOnce(fx.prisma, mine())).toBe(0);
      expect(await readWikiPage(fx.prisma, mine(), "Rules")).toBeUndefined();
    }));

  it("keeps the marker out of the pages that are listed", () =>
    system(async () => {
      expect((await listWikiPages(fx.prisma, mine())).every((p) => !p.title.startsWith("."))).toBe(
        true,
      );
    }));

  it("imports for each member separately, and never replaces a page that exists", () =>
    system(async () => {
      await writeWikiPage(fx.prisma, mine(), { title: "Contacts", body: "Already written." });
      await memory(fx.otherUserId, "Rules.md", "A colleague's version.");
      await memory(fx.otherUserId, "Contacts.md", "Ana: ana@example.test");
      await memory(fx.otherUserId, "Bot note.md", "belongs to a bot", "bot");
      expect(await importSharedMemoryOnce(fx.prisma, colleague())).toBe(1);
      expect((await readWikiPage(fx.prisma, mine(), "Contacts"))?.body).toBe("Already written.");
      expect((await readWikiPage(fx.prisma, mine(), "Rules"))?.body).toBe("A colleague's version.");
      expect(await readWikiPage(fx.prisma, mine(), "Bot note")).toBeUndefined();
      expect(await importSharedMemoryOnce(fx.prisma, colleague())).toBe(0);
    }));
});
