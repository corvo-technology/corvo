import { randomUUID } from "node:crypto";
import type { AdapterContext } from "@corvo/adapter-kit";
import { createDb, runAsSystem, runAsTenant } from "@corvo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makePdf } from "./document-fixtures.test-support.js";
import { readThreadDocument } from "./thread-documents.js";

const postgres =
  process.env.VERIFY_DATABASE === "1" && process.env.DATABASE_URL ? describe : describe.skip;

postgres("reading an attached PDF with no computer (PostgreSQL, content encrypted)", () => {
  const { prisma, pool } = createDb(process.env.DATABASE_URL!, { encryptContent: true });
  const id = `doc-${randomUUID()}`;
  const ids = { userId: `${id}-user`, spaceId: `${id}-space`, orgId: `${id}-org` };
  const fixture = <T>(fn: () => Promise<T>) => runAsSystem("test fixture", fn);
  const tenant = <T>(fn: () => Promise<T>) =>
    runAsTenant({ spaceId: ids.spaceId, userId: ids.userId }, fn);
  const stored = new Map<string, Uint8Array>();
  const artifacts = {
    get: async (key: string) => {
      const bytes = stored.get(key);
      if (!bytes) throw new Error("missing");
      return bytes;
    },
  };
  let threadId = "";
  let otherThreadId = "";
  let artifactId = "";
  const context = () =>
    ({
      operationId: "op",
      traceId: "trace",
      spaceId: ids.spaceId,
      userId: ids.userId,
      botId: "bot",
      signal: new AbortController().signal,
    }) as AdapterContext & { botId: string };

  beforeAll(() =>
    fixture(async () => {
      await prisma.user.create({
        data: { id: ids.userId, name: "Doc", email: `${id}@corvo.test` },
      });
      await prisma.organization.create({
        data: { id: ids.orgId, name: "Doc", slug: id, createdAt: new Date() },
      });
      await prisma.space.create({
        data: { id: ids.spaceId, organizationId: ids.orgId, name: "x" },
      });
      const [bot, other] = await Promise.all(
        ["one", "two"].map((name) =>
          prisma.bot.create({
            data: {
              spaceId: ids.spaceId,
              userId: ids.userId,
              name,
              color: "ink",
              thread: { create: { spaceId: ids.spaceId, userId: ids.userId } },
            },
            include: { thread: true },
          }),
        ),
      );
      threadId = bot!.thread!.id;
      otherThreadId = other!.thread!.id;
      const bytes = makePdf(["The Alpha contract is signed.", "Work starts on the 12th."]);
      stored.set("storage-1", bytes);
      const artifact = await prisma.artifact.create({
        data: {
          spaceId: ids.spaceId,
          userId: ids.userId,
          name: "Alpha contract.pdf",
          mimeType: "application/pdf",
          size: bytes.byteLength,
          hash: "h",
          storageKey: "storage-1",
        },
      });
      artifactId = artifact.id;
      await prisma.message.create({
        data: {
          threadId,
          seq: 0,
          role: "user",
          blocks: [
            { kind: "text", text: "Please summarise this." },
            {
              kind: "file",
              artifactId,
              name: artifact.name,
              mimeType: artifact.mimeType,
              size: artifact.size,
            },
          ],
        },
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

  const read = (thread: string, file?: string) =>
    tenant(() =>
      readThreadDocument({ prisma, artifacts } as never, {
        threadId: thread,
        context: context(),
        file,
      }),
    );

  it("lists the file the person attached, though the message is sealed in the database", async () => {
    const result = (await read(threadId)) as { documents: Array<{ name: string; path: string }> };
    expect(result.documents).toEqual([
      expect.objectContaining({
        name: "Alpha contract.pdf",
        path: `attachments/${artifactId}.pdf`,
      }),
    ]);
  });

  it("reads its text by path, and by name", async () => {
    for (const file of [`attachments/${artifactId}.pdf`, "alpha contract.pdf"]) {
      const result = (await read(threadId, file)) as { text: string; pages: number };
      expect(result.pages).toBe(2);
      expect(result.text).toContain("The Alpha contract is signed.");
      expect(result.text).toContain("[page 2]");
    }
  });

  it("will not read it from a conversation that did not attach it", async () => {
    expect(await read(otherThreadId, `attachments/${artifactId}.pdf`)).toEqual({
      error: expect.stringMatching(/not attached to this conversation/i),
    });
  });
});
