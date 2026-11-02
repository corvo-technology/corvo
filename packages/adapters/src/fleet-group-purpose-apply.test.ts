import type { PrismaClient } from "@corvo/db";
import { describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
}));
vi.mock("@corvo/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@corvo/db")>()),
  createGroupRepos: () => repo,
}));

import { createFleetGroup, updateFleetGroup } from "./fleet-tools.js";

const run = {
  spaceId: "space-1",
  userId: "user-1",
  botId: "bot-chief",
  groupId: null,
  threadId: "thread-1",
  runId: "run-1",
};

const group = {
  id: "group-1",
  name: "Product",
  threadId: "thread-g",
  members: [
    { botId: "bot-a", name: "A", color: "blue" },
    { botId: "bot-b", name: "B", color: "blue" },
  ],
};

function deps() {
  return {
    prisma: { chatGroup: { findMany: vi.fn(async () => []) } } as unknown as PrismaClient,
    events: { append: vi.fn(async () => undefined), notify: vi.fn(async () => undefined) },
    jobs: { cancel: vi.fn(async () => undefined) },
  } as never;
}

describe("applying an approved group purpose", () => {
  it("creates the group with the approved purpose", async () => {
    repo.createGroup.mockResolvedValue(group);
    await createFleetGroup(deps(), run, {
      name: "Product",
      botIds: ["bot-a", "bot-b"],
      purpose: "Analisa concorrentes",
    });
    expect(repo.createGroup).toHaveBeenCalledWith(
      expect.objectContaining({ spaceId: "space-1", userId: "user-1" }),
      { name: "Product", botIds: ["bot-a", "bot-b"], purpose: "Analisa concorrentes" },
    );
  });

  it("creates a group with no purpose key when none was approved", async () => {
    repo.createGroup.mockResolvedValue(group);
    await createFleetGroup(deps(), run, { name: "Product", botIds: ["bot-a", "bot-b"] });
    expect(repo.createGroup.mock.lastCall?.[1]).toEqual({
      name: "Product",
      botIds: ["bot-a", "bot-b"],
    });
  });

  it("updates only the purpose, and clears it with null", async () => {
    repo.updateGroup.mockResolvedValue({ group, cancelledRunIds: [] });
    await updateFleetGroup(deps(), run, {
      groupId: "group-1",
      expectedBotIds: ["bot-a", "bot-b"],
      purpose: "Analisa concorrentes",
    });
    expect(repo.updateGroup.mock.lastCall?.[1]).toMatchObject({
      groupId: "group-1",
      purpose: "Analisa concorrentes",
    });
    expect(repo.updateGroup.mock.lastCall?.[1].botIds).toBeUndefined();
    await updateFleetGroup(deps(), run, {
      groupId: "group-1",
      expectedBotIds: ["bot-a", "bot-b"],
      purpose: null,
    });
    expect(repo.updateGroup.mock.lastCall?.[1]).toMatchObject({ purpose: null });
  });
});
