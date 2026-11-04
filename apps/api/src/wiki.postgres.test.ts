import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAsSystem } from "@corvo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sessionCookieHeader } from "../../../packages/testkit/src/index.js";
import { createApp } from "./app.js";

const describePostgres =
  process.env.VERIFY_DATABASE === "1" && process.env.DATABASE_URL
    ? describe.sequential
    : describe.skip;

describePostgres("the wiki procedures", () => {
  const origin = "http://127.0.0.1:5173";
  let handles: Awaited<ReturnType<typeof createApp>>;
  let dataDir: string;
  const people: Record<string, { cookie: string; userId: string; spaceId: string }> = {};

  async function signUp(name: string) {
    const email = `wiki-${name}-${Date.now()}@corvo.test`;
    const response = await handles.app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ email, password: "test-password-123", name }),
    });
    expect(response.status).toBeLessThan(400);
    const { userId, spaceId } = await runAsSystem("test fixture", async () => {
      const user = await handles.prisma.user.findFirstOrThrow({ where: { email } });
      const member = await handles.prisma.spaceMember.findFirstOrThrow({
        where: { userId: user.id },
      });
      return { userId: user.id, spaceId: member.spaceId };
    });
    people[name] = { cookie: sessionCookieHeader(response), userId, spaceId };
  }

  const call = async (name: string, procedure: string, input: unknown = {}) => {
    const response = await handles.app.request(`/rpc/${procedure}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: people[name]!.cookie, origin },
      body: JSON.stringify({ json: input }),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text).json : undefined };
  };

  beforeAll(async () => {
    dataDir = await mkdtemp(join(tmpdir(), "corvo-wiki-"));
    handles = await createApp({
      databaseUrl: process.env.DATABASE_URL!,
      dataDir,
      sandboxProvider: "fake",
      agentRuntime: "scripted",
      wakeupDriver: "memory",
      signupsEnabled: "true",
      webOrigin: origin,
      authUrl: origin,
    });
    await signUp("ada");
    await signUp("grace");
  });
  afterAll(async () => {
    await handles?.stop();
    if (dataDir) await rm(dataDir, { recursive: true, force: true });
  });

  it("brings shared memory in the first time the wiki is opened, and only then", async () => {
    const memory = (path: string, content: string) =>
      runAsSystem("test fixture", () =>
        handles.prisma.memoryDocument.create({
          data: {
            spaceId: people.ada!.spaceId,
            userId: people.ada!.userId,
            scope: "user",
            path,
            content,
          },
        }),
      );
    await memory("Rules.md", "Always answer in Portuguese.");
    const first = (await call("ada", "wiki/index")).body;
    expect(first.map((p: { title: string }) => p.title)).toEqual(["Rules"]);
    await memory("Later.md", "Written after the first opening.");
    const second = (await call("ada", "wiki/index")).body;
    expect(second.map((p: { title: string }) => p.title)).toEqual(["Rules"]);
  });

  it("writes, reads, searches, versions and removes a page", async () => {
    const written = await call("ada", "wiki/write", {
      title: "Launch Plan",
      body: "The marigold campaign. See [[Budget]].",
    });
    expect(written.status).toBe(200);
    expect(written.body).toMatchObject({
      title: "Launch Plan",
      revision: 1,
      links: ["Budget"],
      missing: ["Budget"],
    });
    expect((await call("ada", "wiki/read", { title: "launch plan" })).body.body).toContain(
      "marigold",
    );
    expect(
      (await call("ada", "wiki/index")).body.map((p: { title: string }) => p.title).sort(),
    ).toEqual(["Launch Plan", "Rules"]);
    const hits = (await call("ada", "wiki/search", { query: "marig" })).body;
    expect(hits).toEqual([expect.objectContaining({ title: "Launch Plan" })]);
    await call("ada", "wiki/write", {
      title: "Launch Plan",
      body: "Rewritten.",
      expectedRevision: 1,
    });
    const history = (await call("ada", "wiki/history", { title: "Launch Plan" })).body;
    expect(history.map((r: { revision: number }) => r.revision)).toEqual([2, 1]);
    const restored = (await call("ada", "wiki/restore", { title: "Launch Plan", revision: 1 }))
      .body;
    expect(restored).toMatchObject({ revision: 3 });
    expect(restored.body).toContain("marigold");
    expect((await call("ada", "wiki/remove", { title: "Launch Plan" })).body).toEqual({ ok: true });
    expect((await call("ada", "wiki/read", { title: "Launch Plan" })).status).toBe(404);
  });

  it("answers a stale save with a conflict and a second spelling with a bad request", async () => {
    await call("ada", "wiki/write", { title: "Café", body: "one" });
    await call("ada", "wiki/write", { title: "Café", body: "two", expectedRevision: 1 });
    const stale = await call("ada", "wiki/write", {
      title: "Café",
      body: "three",
      expectedRevision: 1,
    });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ code: "CONFLICT" });
    const spelling = await call("ada", "wiki/write", { title: "cafe", body: "x" });
    expect(spelling.status).toBe(400);
    expect(spelling.body).toMatchObject({ code: "BAD_REQUEST" });
    expect((await call("ada", "wiki/write", { title: "!!", body: "x" })).status).toBe(400);
    expect((await call("ada", "wiki/history", { title: "Nobody" })).status).toBe(404);
    expect((await call("ada", "wiki/restore", { title: "Café", revision: 99 })).status).toBe(404);
  });

  it("keeps one space's pages from another's", async () => {
    await call("ada", "wiki/write", { title: "Private To Ada", body: "secret marigold" });
    expect((await call("grace", "wiki/index")).body).toEqual([]);
    expect((await call("grace", "wiki/read", { title: "Private To Ada" })).status).toBe(404);
    expect((await call("grace", "wiki/search", { query: "marigold" })).body).toEqual([]);
    expect((await call("grace", "wiki/remove", { title: "Private To Ada" })).body).toEqual({
      ok: true,
    });
    expect((await call("ada", "wiki/read", { title: "Private To Ada" })).status).toBe(200);
  });

  it("refuses someone who is not signed in", async () => {
    const response = await handles.app.request("/rpc/wiki/index", {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ json: {} }),
    });
    expect(response.status).toBeGreaterThanOrEqual(401);
    expect(response.status).toBeLessThan(500);
  });
});
