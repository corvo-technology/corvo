import type { Prisma } from "@corvo/db";
import { describe, expect, it, vi } from "vitest";
import { groupConversationOwner } from "./group-owner.js";

function tx(runs: Array<{ botId: string; status: string; createdAt: number }>) {
  const findFirst = vi.fn(
    async (args: {
      where: { status?: { in?: string[]; not?: string }; botId: { in: string[] } };
      orderBy: { createdAt: "desc" };
    }) => {
      const matching = runs
        .filter((run) => args.where.botId.in.includes(run.botId))
        .filter((run) => !args.where.status?.in || args.where.status.in.includes(run.status))
        .filter((run) => !args.where.status?.not || run.status !== args.where.status.not)
        .sort((a, b) => b.createdAt - a.createdAt);
      return matching[0] ? { botId: matching[0].botId } : null;
    },
  );
  return { client: { run: { findFirst } } as unknown as Prisma.TransactionClient, findFirst };
}

describe("groupConversationOwner", () => {
  it("is the member whose work is waiting on the person, even if another worked later", async () => {
    const { client } = tx([
      { botId: "designer", status: "waiting_takeover", createdAt: 1 },
      { botId: "manager", status: "completed", createdAt: 2 },
    ]);
    expect(await groupConversationOwner(client, "thread", ["manager", "designer"])).toBe(
      "designer",
    );
  });

  it("counts an answer, an approval and a takeover alike", async () => {
    for (const status of ["waiting_input", "waiting_takeover"]) {
      const { client } = tx([{ botId: "b", status, createdAt: 1 }]);
      expect(await groupConversationOwner(client, "t", ["a", "b"])).toBe("b");
    }
  });

  it("otherwise is the member who worked last", async () => {
    const { client } = tx([
      { botId: "manager", status: "completed", createdAt: 1 },
      { botId: "designer", status: "completed", createdAt: 5 },
      { botId: "manager", status: "failed", createdAt: 3 },
    ]);
    expect(await groupConversationOwner(client, "t", ["manager", "designer"])).toBe("designer");
  });

  it("does not count a run that was cancelled, and ignores bots that left the group", async () => {
    const { client } = tx([
      { botId: "manager", status: "completed", createdAt: 1 },
      { botId: "designer", status: "cancelled", createdAt: 9 },
      { botId: "gone", status: "completed", createdAt: 10 },
    ]);
    expect(await groupConversationOwner(client, "t", ["manager", "designer"])).toBe("manager");
  });

  it("has no opinion before anyone has worked", async () => {
    const { client } = tx([]);
    expect(await groupConversationOwner(client, "t", ["a", "b"])).toBeUndefined();
  });
});
