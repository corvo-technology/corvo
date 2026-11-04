import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { contentEncryptionOf } from "./content-encryption.js";
import { runAsSystem } from "./row-security.js";
import { wikiTestFixture } from "./wiki-test-fixture.js";

const describePostgres =
  process.env.VERIFY_DATABASE && process.env.DATABASE_URL ? describe.sequential : describe.skip;

describePostgres("wiki page columns (PostgreSQL)", () => {
  let fx: Awaited<ReturnType<typeof wikiTestFixture>>;
  beforeAll(async () => {
    fx = await wikiTestFixture();
  });
  afterAll(() => fx?.close());

  const system = <T>(work: () => Promise<T>) => runAsSystem("test fixture", work);
  const page = (spaceId: string, path: string, content: string, slug = path, scope = "wiki") => ({
    spaceId,
    userId: fx.userId,
    scope,
    path,
    slug,
    content,
  });
  const stored = async (id: string) =>
    (
      await fx.query<{ tokens: number[]; content: string }>(
        `SELECT "searchTokens" AS tokens, content FROM memory_documents WHERE id = $1`,
        [id],
      )
    )[0]!;
  const wordTokens = async (spaceId: string, word: string) =>
    (await contentEncryptionOf(fx.prisma)!.wikiSearchTokens(spaceId, word))[0]!;

  it("keeps word tokens of a wiki page's text, and the text itself sealed", () =>
    system(async () => {
      const row = await fx.prisma.memoryDocument.create({
        data: page(fx.spaceId, "Tokens One.md", "Marigold launch plan", "tokens one"),
      });
      const raw = await stored(row.id);
      expect(raw.content).not.toContain("Marigold");
      const marigold = await wordTokens(fx.spaceId, "marigold");
      expect(marigold.length).toBeGreaterThan(0);
      for (const token of marigold) expect(raw.tokens).toContain(token);
    }));

  it("keeps no tokens for memory that is not a wiki page", () =>
    system(async () => {
      const row = await fx.prisma.memoryDocument.create({
        data: page(fx.spaceId, "notes.md", "Marigold launch plan", "notes", "user"),
      });
      expect((await stored(row.id)).tokens).toEqual([]);
    }));

  it("replaces the tokens when a wiki page is rewritten", () =>
    system(async () => {
      const row = await fx.prisma.memoryDocument.create({
        data: page(fx.spaceId, "Tokens Two.md", "Marigold launch plan", "tokens two"),
      });
      await fx.prisma.memoryDocument.update({
        where: { id: row.id },
        data: { scope: "wiki", content: "Dahlia budget review" },
      });
      const raw = await stored(row.id);
      const dahlia = await wordTokens(fx.spaceId, "dahlia");
      const marigold = await wordTokens(fx.spaceId, "marigold");
      for (const token of dahlia) expect(raw.tokens).toContain(token);
      expect(marigold.some((token) => raw.tokens.includes(token))).toBe(false);
    }));

  it("refuses two wiki pages with one slug in a space, and no one else", () =>
    system(async () => {
      await fx.prisma.memoryDocument.create({
        data: page(fx.spaceId, "Cafe.md", "a", "cafe"),
      });
      await expect(
        fx.prisma.memoryDocument.create({ data: page(fx.spaceId, "Café.md", "b", "cafe") }),
      ).rejects.toMatchObject({ code: "P2002" });
      await fx.prisma.memoryDocument.create({
        data: page(fx.otherSpaceId, "Cafe.md", "c", "cafe"),
      });
      await fx.prisma.memoryDocument.create({
        data: page(fx.spaceId, "cafe-notes.md", "d", "cafe", "user"),
      });
    }));
});
