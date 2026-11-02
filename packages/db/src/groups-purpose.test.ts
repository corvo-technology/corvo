import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "./client.js";
import { createGroupRepos } from "./groups.js";

const actor = {
  spaceId: "space-1",
  userId: "user-1",
  email: "test@example.test",
  isDeploymentOwner: false,
};

function fixture(purpose: string | null = null) {
  const owned = ["a", "b"].map((id) => ({ id, name: id, color: "gray" }));
  const record = {
    id: "group-1",
    spaceId: actor.spaceId,
    userId: actor.userId,
    name: "Team",
    purpose,
    pinned: false,
    sectionId: null,
    archivedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    thread: { id: "thread-1", unread: false, messages: [] },
    members: owned.map((bot) => ({ bot: { ...bot, runs: [] } })),
  };
  const write = vi.fn().mockResolvedValue({});
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "group-1" }]),
    chatGroup: {
      findFirst: vi.fn(async () => ({
        thread: record.thread,
        members: owned.map((bot) => ({ botId: bot.id, bot: { archivedAt: null } })),
      })),
      update: write,
      findFirstOrThrow: vi.fn().mockResolvedValue(record),
    },
    chatGroupMember: { deleteMany: vi.fn(), createMany: vi.fn() },
    message: { findMany: vi.fn(async () => []) },
  };
  const prisma = {
    bot: { findMany: vi.fn().mockResolvedValue(owned) },
    $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
  };
  return { repos: createGroupRepos(prisma as unknown as PrismaClient), write };
}

function lastUpdate(write: ReturnType<typeof vi.fn>) {
  const call = write.mock.calls.at(-1);
  if (!call) throw new Error("the group was never updated");
  return (call[0] as { data: Record<string, unknown> }).data;
}

describe("group purpose", () => {
  it("stores a trimmed purpose", async () => {
    const f = fixture();
    await f.repos.updateGroup(actor, { groupId: "group-1", purpose: "  Analisa concorrentes  " });
    expect(lastUpdate(f.write).purpose).toBe("Analisa concorrentes");
  });

  it("clears the purpose with an empty string", async () => {
    const f = fixture("Old");
    await f.repos.updateGroup(actor, { groupId: "group-1", purpose: "   " });
    expect(lastUpdate(f.write).purpose).toBeNull();
  });

  it("leaves the purpose alone when the update does not mention it", async () => {
    const f = fixture("Keep");
    await f.repos.updateGroup(actor, { groupId: "group-1", pinned: true });
    expect(lastUpdate(f.write).purpose).toBeUndefined();
  });

  it("returns the stored purpose on the group", async () => {
    const f = fixture("Design and copy");
    const result = await f.repos.updateGroup(actor, { groupId: "group-1", pinned: true });
    expect(result.group.purpose).toBe("Design and copy");
  });
});

describe("group purpose when a group is created", () => {
  function createFixture() {
    const owned = ["a", "b"].map((id) => ({ id, name: id, color: "gray" }));
    const record = {
      id: "group-1",
      spaceId: actor.spaceId,
      userId: actor.userId,
      name: "Team",
      purpose: null,
      pinned: false,
      sectionId: null,
      archivedAt: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
      thread: { id: "thread-1", unread: false, messages: [] },
      members: owned.map((bot) => ({ bot: { ...bot, runs: [] } })),
    };
    const create = vi.fn().mockResolvedValue({ id: "group-1" });
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "space-1" }]),
      spaceMember: {
        findUnique: vi.fn().mockResolvedValue({
          organizationId: "org-1",
          space: { deletingAt: null },
        }),
      },
      chatGroup: { create, findFirstOrThrow: vi.fn().mockResolvedValue(record) },
      chatGroupMember: { createMany: vi.fn() },
      thread: { create: vi.fn() },
      message: { findMany: vi.fn(async () => []) },
    };
    const prisma = {
      bot: { findMany: vi.fn().mockResolvedValue(owned) },
      $transaction: async (run: (client: typeof tx) => unknown) => run(tx),
    };
    return { repos: createGroupRepos(prisma as unknown as PrismaClient), create };
  }

  const dataOf = (create: ReturnType<typeof vi.fn>) => {
    const [args] = create.mock.calls.at(-1) ?? [];
    return (args as { data: Record<string, unknown> }).data;
  };

  it("stores a trimmed purpose", async () => {
    const f = createFixture();
    await f.repos.createGroup(actor, {
      name: "Team",
      botIds: ["a", "b"],
      purpose: "  Analisa concorrentes  ",
    });
    expect(dataOf(f.create).purpose).toBe("Analisa concorrentes");
  });

  it("stores no purpose when none is given or it is blank", async () => {
    const none = createFixture();
    await none.repos.createGroup(actor, { name: "Team", botIds: ["a", "b"] });
    expect(dataOf(none.create).purpose).toBeNull();
    const blank = createFixture();
    await blank.repos.createGroup(actor, { name: "Team", botIds: ["a", "b"], purpose: "   " });
    expect(dataOf(blank.create).purpose).toBeNull();
  });
});
