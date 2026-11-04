import { randomUUID } from "node:crypto";
import {
  createDb,
  createThreadEvents,
  readWikiPage,
  runAsSystem,
  runAsTenant,
  setWikiSettings,
  writeWikiPage,
} from "@corvo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { keepNoteInWiki } from "./wiki-note.js";

const postgres =
  process.env.VERIFY_DATABASE === "1" && process.env.DATABASE_URL ? describe : describe.skip;

postgres("an agent's note kept through the wiki (PostgreSQL)", () => {
  const { prisma, pool } = createDb(process.env.DATABASE_URL!);
  const id = `note-${randomUUID()}`;
  const ids = { userId: `${id}-user`, spaceId: `${id}-space`, orgId: `${id}-org` };
  const scope = { spaceId: ids.spaceId, userId: ids.userId };
  const fixture = <T>(fn: () => Promise<T>) => runAsSystem("test fixture", fn);
  const tenant = <T>(fn: () => Promise<T>) => runAsTenant(scope, fn);
  let thread: {
    id: string;
    spaceId: string;
    userId: string;
    groupId: string | null;
    botId: string | null;
    externalConversationId: string | null;
    wikiCapture: boolean | null;
  };

  beforeAll(() =>
    fixture(async () => {
      await prisma.user.create({
        data: { id: ids.userId, name: "Note", email: `${id}@corvo.test` },
      });
      await prisma.organization.create({
        data: { id: ids.orgId, name: "Note", slug: id, createdAt: new Date() },
      });
      await prisma.space.create({
        data: { id: ids.spaceId, organizationId: ids.orgId, name: "x" },
      });
      const bot = await prisma.bot.create({
        data: { spaceId: ids.spaceId, userId: ids.userId, name: "Leo", color: "ink" },
      });
      thread = await prisma.thread.create({
        data: { spaceId: ids.spaceId, userId: ids.userId, botId: bot.id },
      });
    }),
  );
  afterAll(async () => {
    await fixture(async () => {
      await prisma.organization.deleteMany({ where: { id: ids.orgId } });
      await prisma.user.deleteMany({ where: { id: ids.userId } });
    });
    await prisma.$disconnect();
    await pool.end();
  });

  const deps = () => ({ prisma, events: createThreadEvents(prisma) });
  const keep = (path: string, content: string) =>
    tenant(() => keepNoteInWiki(deps(), { thread, botName: "Leo", path, content }));
  const body = (title: string) =>
    tenant(async () => (await readWikiPage(prisma, scope, title))?.body);

  it("writes a new page at once, named after the document", async () => {
    expect(await keep("Printing Rules.md", "All print jobs go to Clyde.")).toEqual({
      ok: true,
      status: "kept",
      page: "Printing Rules",
    });
    expect(await body("Printing Rules")).toBe("All print jobs go to Clyde.");
  });

  it("leaves a change to an existing page waiting for approval, with the page as it was", async () => {
    await tenant(() => writeWikiPage(prisma, scope, { title: "Door Codes", body: "Front: 1111." }));
    expect(await keep("Door Codes", "Front: 2222.")).toEqual({
      ok: true,
      status: "waiting for approval",
      page: "Door Codes",
    });
    expect(await body("Door Codes")).toBe("Front: 1111.");
  });

  it("changes the page at once when the Space says edits go in without approval", async () => {
    await tenant(() => writeWikiPage(prisma, scope, { title: "Coffee Rota", body: "Mon: Ana." }));
    await fixture(() => setWikiSettings(prisma, ids.spaceId, { edits: "auto" }));
    try {
      expect(await keep("Coffee Rota", "Mon: Leo.")).toMatchObject({ ok: true, status: "kept" });
      // Text for an existing page is added to it, never put in its place.
      expect(await body("Coffee Rota")).toBe("Mon: Ana.\n\nMon: Leo.");
    } finally {
      await fixture(() => setWikiSettings(prisma, ids.spaceId, { edits: "approve" }));
    }
  });

  it("says so, and writes nothing, when the page already says this", async () => {
    await tenant(() => writeWikiPage(prisma, scope, { title: "Same Page", body: "Same." }));
    expect(await keep("Same Page", "Same.")).toEqual({
      ok: true,
      status: "unchanged",
      page: "Same Page",
    });
  });

  it("shows the person what was kept, in the conversation, so it can be undone", async () => {
    await keep("Shown Page", "Shown in the chat.");
    const card = await fixture(() =>
      prisma.message.findFirst({ where: { threadId: thread.id }, orderBy: { seq: "desc" } }),
    );
    expect(card?.blocks).toEqual([
      expect.objectContaining({
        kind: "wiki_change",
        pages: [{ title: "Shown Page", op: "create" }],
      }),
    ]);
  });

  it("refuses a name that is no title at all", async () => {
    expect(await keep("???", "Text.")).toEqual({
      error: "path must name a page with a letter or a digit in it",
    });
  });

  it("adds only what is new when the agent sends the page it read with a line on the end", async () => {
    await tenant(() => writeWikiPage(prisma, scope, { title: "Frozen Rules", body: "Rule one." }));
    expect(await keep("Frozen Rules", "Rule one.\n\nRule two.")).toMatchObject({
      status: "waiting for approval",
    });
    const change = await fixture(() =>
      prisma.wikiChange.findFirstOrThrow({ orderBy: { createdAt: "desc" } }),
    );
    expect(change.ops).toEqual([{ op: "append", page: "Frozen Rules", text: "Rule two." }]);
  });

  it("never wipes what was written on a page after the agent last read it", async () => {
    await tenant(() => writeWikiPage(prisma, scope, { title: "Moved On", body: "Rule one." }));
    await tenant(() =>
      writeWikiPage(prisma, scope, {
        title: "Moved On",
        body: "Rule one.\n\nWritten by a colleague.",
        expectedRevision: 1,
      }),
    );
    // The agent still has the old copy and adds a line to it.
    await fixture(() => setWikiSettings(prisma, ids.spaceId, { edits: "auto" }));
    try {
      await keep("Moved On", "Rule one.\n\nRule two.");
      const text = await body("Moved On");
      expect(text).toContain("Written by a colleague.");
      expect(text).toContain("Rule two.");
    } finally {
      await fixture(() => setWikiSettings(prisma, ids.spaceId, { edits: "approve" }));
    }
  });
});
