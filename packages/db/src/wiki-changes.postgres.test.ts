import type { CuratorOp } from "@corvo/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runAsSystem } from "./row-security.js";
import { readWikiPage, WikiNotFoundError, writeWikiPage } from "./wiki.js";
import {
  advanceWikiCursor,
  createWikiChange,
  decideWikiChange,
  getWikiSettings,
  listWikiChanges,
  setThreadWikiCapture,
  setWikiSettings,
  WikiChangeStateError,
} from "./wiki-changes.js";
import { wikiTestFixture } from "./wiki-test-fixture.js";

const describePostgres =
  process.env.VERIFY_DATABASE && process.env.DATABASE_URL ? describe.sequential : describe.skip;

describePostgres("wiki changes (PostgreSQL)", () => {
  let fx: Awaited<ReturnType<typeof wikiTestFixture>>;
  beforeAll(async () => {
    fx = await wikiTestFixture();
  });
  afterAll(() => fx?.close());

  const system = <T>(work: () => Promise<T>) => runAsSystem("test fixture", work);
  const mine = () => ({ spaceId: fx.spaceId, userId: fx.userId });
  const colleague = () => ({ spaceId: fx.spaceId, userId: fx.otherUserId });
  const elsewhere = () => ({ spaceId: fx.otherSpaceId, userId: fx.userId });
  const write = (title: string, body: string, expectedRevision?: number) =>
    writeWikiPage(fx.prisma, colleague(), { title, body, expectedRevision });
  const body = async (title: string) => (await readWikiPage(fx.prisma, mine(), title))?.body;
  /** A channel of the person's, which is what gives a conversation its owner. */
  const thread = async () => {
    const group = await fx.prisma.chatGroup.create({
      data: { spaceId: fx.spaceId, userId: fx.userId, name: "Engineering" },
    });
    return fx.prisma.thread.create({
      data: { spaceId: fx.spaceId, userId: fx.userId, groupId: group.id },
    });
  };

  let counter = 0;
  /** A change from a conversation stretch; each call reads a stretch no earlier call did. */
  async function propose(
    ops: CuratorOp[],
    edits: "auto" | "approve" = "approve",
    scope = mine(),
    extra: { threadId?: string; from?: number; to?: number } = {},
  ) {
    const threadId = extra.threadId ?? (await thread()).id;
    counter += 1;
    return createWikiChange(fx.prisma, scope, {
      source: {
        origin: "conversation",
        title: "Kickoff call",
        text: "Ana: we are going with Alpha Builders.",
        threadId,
        fromSeq: extra.from ?? counter * 10,
        toSeq: extra.to ?? counter * 10 + 5,
      },
      ops,
      reason: "A decision about the lobby",
      anchor: { threadId },
      edits,
    });
  }

  it("writes a new page at once, whatever the setting says", () =>
    system(async () => {
      const change = await propose([
        { op: "create", page: "Lobby Client One", kind: "Client", body: "Chosen for the lobby." },
      ]);
      expect(change?.state).toBe("applied");
      expect(change?.pages).toEqual([{ title: "Lobby Client One", op: "create" }]);
      expect(await body("Lobby Client One")).toContain("Chosen for the lobby.");
    }));

  it("keeps an edit waiting for approval, and applies it once approved", () =>
    system(async () => {
      await write("Plan One", "Status: planning.");
      const change = await propose([
        { op: "replace", page: "Plan One", old: "planning", new: "building" },
      ]);
      expect(change?.state).toBe("pending");
      expect(await body("Plan One")).toBe("Status: planning.");
      const done = await decideWikiChange(fx.prisma, mine(), change!.id, "apply");
      expect(done.state).toBe("applied");
      expect(await body("Plan One")).toBe("Status: building.");
    }));

  it("applies an edit at once when the Space says so", () =>
    system(async () => {
      await write("Plan Two", "Status: planning.");
      const change = await propose(
        [{ op: "append", page: "Plan Two", section: "Risks", text: "Permit delay." }],
        "auto",
      );
      expect(change?.state).toBe("applied");
      expect(await body("Plan Two")).toBe("Status: planning.\n\n## Risks\n\nPermit delay.");
    }));

  it("applies a new page now and leaves the edit of a package that has both waiting", () =>
    system(async () => {
      await write("Plan Three", "Status: planning.");
      const change = await propose([
        { op: "create", page: "Lobby Client Two", body: "Chosen." },
        { op: "replace", page: "Plan Three", old: "planning", new: "building" },
      ]);
      expect(change?.state).toBe("pending");
      expect(await body("Lobby Client Two")).toBe("Chosen.");
      expect(await body("Plan Three")).toBe("Status: planning.");
      await decideWikiChange(fx.prisma, mine(), change!.id, "apply");
      expect(await body("Plan Three")).toBe("Status: building.");
    }));

  it("undoes what a change wrote and restores the text before it", () =>
    system(async () => {
      await write("Plan Four", "Status: planning.");
      const change = await propose(
        [
          { op: "replace", page: "Plan Four", old: "planning", new: "building" },
          { op: "create", page: "Lobby Client Three", body: "Chosen." },
        ],
        "auto",
      );
      const undone = await decideWikiChange(fx.prisma, mine(), change!.id, "undo");
      expect(undone.state).toBe("undone");
      expect(await body("Plan Four")).toBe("Status: planning.");
      expect(await body("Lobby Client Three")).toBeUndefined();
    }));

  it("marks a change conflicting when its page moved, and never overwrites the newer text", () =>
    system(async () => {
      await write("Plan Five", "Status: planning.");
      const change = await propose([
        { op: "replace", page: "Plan Five", old: "planning", new: "building" },
      ]);
      await write("Plan Five", "Status: planning. Budget approved.");
      const result = await decideWikiChange(fx.prisma, mine(), change!.id, "apply");
      expect(result.state).toBe("conflict");
      expect(await body("Plan Five")).toBe("Status: planning. Budget approved.");
    }));

  it("refuses to undo over an edit someone made after the change", () =>
    system(async () => {
      await write("Plan Six", "Status: planning.");
      const change = await propose(
        [{ op: "replace", page: "Plan Six", old: "planning", new: "building" }],
        "auto",
      );
      await write("Plan Six", "Status: building. Inspection on 12/11.");
      const result = await decideWikiChange(fx.prisma, mine(), change!.id, "undo");
      expect(result.state).toBe("conflict");
      expect(await body("Plan Six")).toBe("Status: building. Inspection on 12/11.");
    }));

  it("changes no page when a change is refused", () =>
    system(async () => {
      await write("Plan Seven", "Status: planning.");
      const change = await propose([
        { op: "replace", page: "Plan Seven", old: "planning", new: "building" },
      ]);
      const result = await decideWikiChange(fx.prisma, mine(), change!.id, "refuse");
      expect(result.state).toBe("refused");
      expect(await body("Plan Seven")).toBe("Status: planning.");
    }));

  it("answers a decision only once, from a state that allows it", () =>
    system(async () => {
      await write("Plan Eight", "Status: planning.");
      const change = await propose([
        { op: "replace", page: "Plan Eight", old: "planning", new: "building" },
      ]);
      await decideWikiChange(fx.prisma, mine(), change!.id, "apply");
      await expect(decideWikiChange(fx.prisma, mine(), change!.id, "apply")).rejects.toThrow(
        WikiChangeStateError,
      );
      await expect(decideWikiChange(fx.prisma, mine(), change!.id, "refuse")).rejects.toThrow(
        WikiChangeStateError,
      );
    }));

  it("drops operations that cannot apply, and makes no change when none can", () =>
    system(async () => {
      await write("Plan Nine", "Status: planning.");
      const none = await propose([
        { op: "replace", page: "Plan Nine", old: "cancelled", new: "x" },
        { op: "create", page: "Plan Nine", body: "A second copy." },
        { op: "append", page: "No Such Page", text: "Orphan." },
      ]);
      expect(none).toBeNull();
      expect(await body("Plan Nine")).toBe("Status: planning.");
    }));

  it("never keeps the same stretch of a conversation twice", () =>
    system(async () => {
      const t = await thread();
      const ops: CuratorOp[] = [{ op: "create", page: "Lobby Client Four", body: "Chosen." }];
      const first = await propose(ops, "approve", mine(), { threadId: t.id, from: 1, to: 6 });
      const again = await propose(
        [{ op: "create", page: "Lobby Client Five", body: "Chosen." }],
        "approve",
        mine(),
        { threadId: t.id, from: 1, to: 6 },
      );
      expect(first).not.toBeNull();
      expect(again).toBeNull();
      expect(await body("Lobby Client Five")).toBeUndefined();
    }));

  it("lets one reader move a conversation's cursor once", () =>
    system(async () => {
      const t = await thread();
      expect(await advanceWikiCursor(fx.prisma, t.id, null, 14)).toBe(true);
      expect(await advanceWikiCursor(fx.prisma, t.id, null, 20)).toBe(false);
      expect(await advanceWikiCursor(fx.prisma, t.id, 14, 20)).toBe(true);
    }));

  it("lists the changes of the Space, by state, and shows none to another Space", () =>
    system(async () => {
      await write("Plan Ten", "Status: planning.");
      const change = await propose([
        { op: "replace", page: "Plan Ten", old: "planning", new: "building" },
      ]);
      const waiting = await listWikiChanges(fx.prisma, mine(), { state: ["pending"] });
      expect(waiting.map((item) => item.id)).toContain(change!.id);
      expect(
        (await listWikiChanges(fx.prisma, mine(), { state: ["refused"] })).map((c) => c.id),
      ).not.toContain(change!.id);
      expect(await listWikiChanges(fx.prisma, elsewhere())).toEqual([]);
      await expect(decideWikiChange(fx.prisma, elsewhere(), change!.id, "apply")).rejects.toThrow(
        WikiNotFoundError,
      );
    }));

  it("hands back the quoted source with the change, for the route to show or hide", () =>
    system(async () => {
      const change = await propose([{ op: "create", page: "Lobby Client Six", body: "Chosen." }]);
      expect(change).toMatchObject({
        sourceTitle: "Kickoff call",
        sourceText: "Ana: we are going with Alpha Builders.",
        sourceUserId: fx.userId,
      });
    }));

  it("keeps the Space's two settings, with defaults until someone changes them", () =>
    system(async () => {
      expect(await getWikiSettings(fx.prisma, fx.otherSpaceId)).toEqual({
        capture: true,
        edits: "approve",
      });
      expect(await setWikiSettings(fx.prisma, fx.otherSpaceId, { edits: "auto" })).toEqual({
        capture: true,
        edits: "auto",
      });
      expect(await setWikiSettings(fx.prisma, fx.otherSpaceId, { capture: false })).toEqual({
        capture: false,
        edits: "auto",
      });
    }));

  it("keeps a conversation's own switch, only for its owner in its Space", () =>
    system(async () => {
      const t = await thread();
      const owner = { threadId: t.id, spaceId: fx.spaceId, userId: fx.userId };
      expect(await setThreadWikiCapture(fx.prisma, owner, true)).toBe(true);
      expect((await fx.prisma.thread.findUniqueOrThrow({ where: { id: t.id } })).wikiCapture).toBe(
        true,
      );
      expect(await setThreadWikiCapture(fx.prisma, owner, null)).toBe(true);
      expect(
        (await fx.prisma.thread.findUniqueOrThrow({ where: { id: t.id } })).wikiCapture,
      ).toBeNull();
      expect(
        await setThreadWikiCapture(fx.prisma, { ...owner, userId: fx.otherUserId }, false),
      ).toBe(false);
      expect(
        await setThreadWikiCapture(fx.prisma, { ...owner, spaceId: fx.otherSpaceId }, false),
      ).toBe(false);
    }));
});
