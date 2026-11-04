import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAsSystem } from "@corvo/db";
import { describe, expect, it } from "vitest";
import { sessionCookieHeader } from "../../../packages/testkit/src/index.js";
import { createApp } from "./app.js";

const describePostgres =
  process.env.VERIFY_DATABASE === "1" && process.env.DATABASE_URL
    ? describe.sequential
    : describe.skip;

describePostgres("memory procedures beside the wiki", () => {
  it("never list, edit, delete or export a wiki page as if it were memory", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "corvo-memory-wiki-"));
    const handles = await createApp({
      databaseUrl: process.env.DATABASE_URL!,
      dataDir,
      sandboxProvider: "fake",
      agentRuntime: "scripted",
      wakeupDriver: "memory",
      signupsEnabled: "true",
      webOrigin: "http://127.0.0.1:5173",
      authUrl: "http://127.0.0.1:5173",
    });
    try {
      const email = `memory-wiki-${Date.now()}@corvo.test`;
      const signup = await handles.app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://127.0.0.1:5173" },
        body: JSON.stringify({ email, password: "test-password-123", name: "Wiki tester" }),
      });
      expect(signup.status).toBeLessThan(400);
      const cookie = sessionCookieHeader(signup);
      const call = (procedure: string, input: unknown = {}) =>
        handles.app.request(`/rpc/${procedure}`, {
          method: "POST",
          headers: { "content-type": "application/json", cookie, origin: "http://127.0.0.1:5173" },
          body: JSON.stringify({ json: input }),
        });

      const { userId, spaceId } = await runAsSystem("test fixture", async () => {
        const user = await handles.prisma.user.findFirstOrThrow({ where: { email } });
        const member = await handles.prisma.spaceMember.findFirstOrThrow({
          where: { userId: user.id },
        });
        return { userId: user.id, spaceId: member.spaceId };
      });
      const page = await runAsSystem("test fixture", () =>
        handles.prisma.memoryDocument.create({
          data: {
            spaceId,
            userId,
            scope: "wiki",
            path: "Launch Plan.md",
            slug: "launch plan",
            content: "The marigold campaign.",
          },
        }),
      );
      const stored = () =>
        runAsSystem("test fixture", () =>
          handles.prisma.memoryDocument.findUnique({ where: { id: page.id } }),
        );

      const list = await call("memory/list");
      expect(list.status).toBe(200);
      const listed = ((await list.json()) as { json: Array<{ scope: string }> }).json;
      expect(listed.length).toBeGreaterThan(0);
      expect(listed.every((doc) => doc.scope === "bot" || doc.scope === "user")).toBe(true);

      const update = await call("memory/update", { documentId: page.id, content: "overwritten" });
      expect(update.status).toBeGreaterThanOrEqual(400);
      expect((await stored())?.content).toBe("The marigold campaign.");

      const remove = await call("memory/remove", { documentId: page.id });
      expect(remove.status).toBeGreaterThanOrEqual(400);
      expect(await stored()).not.toBeNull();

      const exported = await call("memory/exportMarkdown");
      expect(exported.status).toBe(200);
      expect(JSON.stringify(await exported.json())).not.toContain("marigold");
    } finally {
      await handles.stop();
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
