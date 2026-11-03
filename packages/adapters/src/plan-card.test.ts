import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutorDeps } from "./executor-deps.js";
import { setPlanCard, updatePlanCard } from "./plan-card.js";

const publish = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => ({})));
vi.mock("./run-messages.js", () => ({ publishMessage: publish }));
vi.mock("@corvo/db", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  appendEventInTransaction: vi.fn(async () => ({ seq: 9 })),
}));

const run = {
  id: "run-1",
  spaceId: "space-1",
  threadId: "thread-1",
  botId: "bot-1",
  trigger: "user",
};

const plan = {
  kind: "plan",
  title: "Bio",
  steps: [
    { id: "1", label: "Write five versions", owner: "Writer", status: "pending" },
    { id: "2", label: "Review the tone", status: "pending" },
  ],
};

function setup(messages: Array<{ id: string; blocks: unknown[] }>) {
  const update = vi.fn(async (_args: unknown) => ({}));
  const notify = vi.fn(async () => undefined);
  const deps = {
    prisma: {
      message: { findMany: vi.fn(async (_args: unknown) => messages) },
      $transaction: vi.fn(async (work: (tx: unknown) => unknown) => work({ message: { update } })),
    },
    events: { notify },
  } as unknown as ExecutorDeps;
  return { deps, update, notify };
}

beforeEach(() => publish.mockClear());

describe("setPlanCard", () => {
  it("shows the plan as one card, every step waiting, with ids the bot can update", async () => {
    const { deps } = setup([]);
    const result = await setPlanCard(deps, run, {
      title: "  Bio  ",
      steps: [{ label: "Write", owner: "Writer" }, { label: "  " }, { label: "Review" }],
    });
    expect(result).toMatchObject({
      ok: true,
      steps: [
        { id: "1", label: "Write" },
        { id: "2", label: "Review" },
      ],
    });
    expect(publish).toHaveBeenCalledWith(deps, run, "bot", [
      {
        kind: "plan",
        title: "Bio",
        steps: [
          { id: "1", label: "Write", owner: "Writer", status: "pending" },
          { id: "2", label: "Review", status: "pending" },
        ],
      },
    ]);
  });

  it("keeps at most twelve steps and needs a title and a step", async () => {
    const { deps } = setup([]);
    await setPlanCard(deps, run, {
      title: "Big",
      steps: Array.from({ length: 20 }, (_, i) => ({ label: `s${i}` })),
    });
    const blocks = publish.mock.calls[0]?.[3] as Array<{ steps: unknown[] }>;
    expect(blocks[0]?.steps).toHaveLength(12);
    expect(await setPlanCard(deps, run, { title: "", steps: [{ label: "x" }] })).toHaveProperty(
      "error",
    );
    expect(await setPlanCard(deps, run, { title: "x", steps: [] })).toHaveProperty("error");
    expect(publish).toHaveBeenCalledTimes(1);
  });
});

describe("updatePlanCard", () => {
  it("changes a step's status and note on the latest plan, in place, and tells the chat", async () => {
    const { deps, update, notify } = setup([{ id: "m-plan", blocks: [plan] }]);
    const result = await updatePlanCard(deps, run, {
      updates: [{ step: "1", status: "running", note: "Asked the Marketing team" }],
    });
    expect(result).toMatchObject({
      ok: true,
      steps: [
        { id: "1", status: "running" },
        { id: "2", status: "pending" },
      ],
    });
    const saved = update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { blocks: Array<{ steps: Array<Record<string, unknown>> }> };
    };
    expect(saved.where).toEqual({ id: "m-plan" });
    expect(saved.data.blocks[0]?.steps[0]).toMatchObject({
      status: "running",
      note: "Asked the Marketing team",
    });
    expect(saved.data.blocks[0]?.steps[1]).toMatchObject({ status: "pending" });
    expect(notify).toHaveBeenCalledWith("thread-1", 9);
  });

  it("adds a step after the last one and clears a note sent empty", async () => {
    const withNote = {
      ...plan,
      steps: [{ ...plan.steps[0]!, note: "old" }, plan.steps[1]!],
    };
    const { deps, update } = setup([{ id: "m-plan", blocks: [withNote] }]);
    await updatePlanCard(deps, run, {
      updates: [{ step: "1", note: "" }],
      add: [{ label: "Publish", owner: "Social" }],
    });
    const saved = update.mock.calls[0]?.[0] as {
      data: { blocks: Array<{ steps: Array<Record<string, unknown>> }> };
    };
    const steps = saved.data.blocks[0]?.steps ?? [];
    expect(steps[0]).not.toHaveProperty("note");
    expect(steps[2]).toEqual({ id: "3", label: "Publish", owner: "Social", status: "pending" });
  });

  it("refuses an unknown step, an unknown status, and an empty update, without saving", async () => {
    const { deps, update } = setup([{ id: "m-plan", blocks: [plan] }]);
    expect(await updatePlanCard(deps, run, { updates: [{ step: "9", status: "done" }] })).toEqual({
      error: expect.stringContaining("No step"),
    });
    expect(await updatePlanCard(deps, run, { updates: [{ step: "1", status: "great" }] })).toEqual({
      error: expect.stringContaining("status must be"),
    });
    expect(await updatePlanCard(deps, run, {})).toHaveProperty("error");
    expect(update).not.toHaveBeenCalled();
  });

  it("says so when the chat has no plan yet", async () => {
    const { deps, update } = setup([{ id: "m", blocks: [{ kind: "text", text: "hi" }] }]);
    expect(await updatePlanCard(deps, run, { updates: [{ step: "1", status: "done" }] })).toEqual({
      error: expect.stringContaining("plan_set"),
    });
    expect(update).not.toHaveBeenCalled();
  });
});
