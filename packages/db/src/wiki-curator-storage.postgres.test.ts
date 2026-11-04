import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runAsSystem } from "./row-security.js";
import { wikiTestFixture } from "./wiki-test-fixture.js";

const describePostgres =
  process.env.VERIFY_DATABASE && process.env.DATABASE_URL ? describe.sequential : describe.skip;

describePostgres("what the wiki curator keeps (PostgreSQL)", () => {
  let fx: Awaited<ReturnType<typeof wikiTestFixture>>;
  beforeAll(async () => {
    fx = await wikiTestFixture();
  });
  afterAll(() => fx?.close());
  const system = <T>(work: () => Promise<T>) => runAsSystem("test fixture", work);

  it("seals a source's words and a change's operations, and reads them back", () =>
    system(async () => {
      const source = await fx.prisma.wikiSource.create({
        data: {
          spaceId: fx.spaceId,
          userId: fx.userId,
          origin: "note",
          title: "Kickoff call",
          text: "We are going with Alpha Builders for the lobby.",
        },
      });
      const change = await fx.prisma.wikiChange.create({
        data: {
          spaceId: fx.spaceId,
          userId: fx.userId,
          sourceId: source.id,
          ops: [{ op: "create", page: "Alpha Builders", body: "Chosen for the lobby." }],
          reason: "A decision about the lobby",
          baseRevisions: { "Alpha Builders": 0 },
        },
      });
      const [rawSource] = await fx.query<{ title: string; text: string }>(
        `SELECT title, text FROM wiki_sources WHERE id = $1`,
        [source.id],
      );
      const [rawChange] = await fx.query<{ ops: string; reason: string }>(
        `SELECT ops::text AS ops, reason FROM wiki_changes WHERE id = $1`,
        [change.id],
      );
      for (const value of [rawSource!.title, rawSource!.text, rawChange!.ops, rawChange!.reason])
        expect(value).toContain("rkz1:");
      expect(rawSource!.text).not.toContain("Alpha Builders");
      expect(rawChange!.ops).not.toContain("lobby");
      const read = await fx.prisma.wikiChange.findUniqueOrThrow({
        where: { id: change.id },
        include: { source: true },
      });
      expect(read.source.text).toBe("We are going with Alpha Builders for the lobby.");
      expect(read.reason).toBe("A decision about the lobby");
      expect(read.ops).toEqual([
        { op: "create", page: "Alpha Builders", body: "Chosen for the lobby." },
      ]);
    }));
});
