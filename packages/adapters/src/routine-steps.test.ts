import { describe, expect, it, vi } from "vitest";
import type { ExecutorDeps } from "./executor-deps.js";
import {
  startNextRoutineStep,
  startWorkflowStepAfter,
  stepPrompt,
  workflowContinuesAfter,
} from "./routine-steps.js";

const done = {
  id: "run-1",
  spaceId: "space-1",
  userId: "user-1",
  routineId: "routine-1",
  trigger: "routine",
  status: "completed",
  routineStepId: null as string | null,
  bot: { name: "Scout" },
};
const step2 = {
  id: "step-2",
  routineId: "routine-1",
  botId: "bot-2",
  position: 2,
  instruction: "Summarize it",
};

function setup(
  overrides: {
    run?: Partial<typeof done> | null;
    next?: typeof step2 | null;
    runCreate?: unknown;
    stopped?: boolean;
  } = {},
) {
  const runCreate = vi.fn(async (_args: unknown) => ({ id: "run-2" }));
  const taskCreate = vi.fn(async (_args: unknown) => ({ id: "task-2" }));
  const enqueue = vi.fn(async (_job: unknown) => undefined);
  const prisma = {
    run: {
      findUnique: vi.fn(async () =>
        overrides.run === null ? null : { ...done, ...overrides.run },
      ),
      create: overrides.runCreate ?? runCreate,
    },
    routineStep: {
      findUnique: vi.fn(async () => ({ position: 2 })),
      findFirst: vi.fn(async () => (overrides.next === undefined ? step2 : overrides.next)),
      count: vi.fn(async () => 1),
    },
    event: {
      findFirst: vi.fn(async (_args: unknown) => (overrides.stopped ? { id: "event-1" } : null)),
    },
    bot: { findFirst: vi.fn(async () => ({ id: "bot-2", thread: { id: "thread-2" } })) },
    routine: {
      findUnique: vi.fn(async () => ({ modelProvider: null, modelId: null, thinkingLevel: null })),
    },
    message: {
      findMany: vi.fn(async () => [
        { blocks: [{ kind: "text", text: "Three leads found." }], clientNonce: null },
      ]),
    },
    task: { create: taskCreate },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) =>
      fn({ task: { create: taskCreate }, run: { create: overrides.runCreate ?? runCreate } }),
    ),
  };
  const deps = { prisma, jobs: { enqueue } } as unknown as ExecutorDeps;
  return { deps, prisma, runCreate, taskCreate, enqueue };
}

describe("startNextRoutineStep", () => {
  it("gives the next agent its instruction and the answer before it, once per completed run", async () => {
    const { deps, runCreate, taskCreate, enqueue } = setup();
    await startNextRoutineStep(deps, "run-1");
    expect(taskCreate.mock.calls[0]![0]).toMatchObject({
      data: {
        botId: "bot-2",
        threadId: "thread-2",
        prompt: stepPrompt("Summarize it", "Scout", "Three leads found."),
      },
    });
    expect(runCreate.mock.calls[0]![0]).toMatchObject({
      data: {
        botId: "bot-2",
        trigger: "routine",
        routineId: "routine-1",
        routineStepId: "step-2",
        stepOfRunId: "run-1",
      },
    });
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("does nothing after a step that called workflow_stop, and looks for that call by name", async () => {
    const { deps, prisma, runCreate, enqueue } = setup({ stopped: true });
    await startNextRoutineStep(deps, "run-1");
    expect(runCreate).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(prisma.event.findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: {
        runId: "run-1",
        type: "agent.tool.called",
        payload: { path: ["name"], equals: "workflow_stop" },
      },
    });
  });

  it("does nothing after a run that did not complete", async () => {
    for (const status of ["failed", "cancelled", "running"]) {
      const { deps, runCreate, enqueue } = setup({ run: { status } });
      await startNextRoutineStep(deps, "run-1");
      expect(runCreate).not.toHaveBeenCalled();
      expect(enqueue).not.toHaveBeenCalled();
    }
  });

  it("does nothing after the last step", async () => {
    const { deps, runCreate, enqueue } = setup({ next: null, run: { routineStepId: "step-2" } });
    await startNextRoutineStep(deps, "run-1");
    expect(runCreate).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("leaves a step already started by another delivery alone", async () => {
    const duplicate = Object.assign(new Error("duplicate"), { code: "P2002" });
    const { deps, enqueue } = setup({
      runCreate: vi.fn(async () => {
        throw duplicate;
      }),
    });
    await expect(startNextRoutineStep(deps, "run-1")).resolves.toBeUndefined();
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe("startWorkflowStepAfter", () => {
  it("queues the next step only for a routine that has steps", async () => {
    const withSteps = setup();
    await startWorkflowStepAfter(withSteps.deps, "routine-1", "run-1");
    expect(withSteps.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ name: "routine.next-step", payload: { runId: "run-1" } }),
    );
    const without = setup();
    without.prisma.routineStep.count.mockResolvedValue(0);
    await startWorkflowStepAfter(without.deps, "routine-1", "run-1");
    expect(without.enqueue).not.toHaveBeenCalled();
  });

  it("never throws when the step cannot be queued", async () => {
    const { deps, enqueue } = setup();
    enqueue.mockRejectedValue(new Error("queue down"));
    await expect(startWorkflowStepAfter(deps, "routine-1", "run-1")).resolves.toBeUndefined();
  });
});

describe("workflowContinuesAfter", () => {
  const prismaWith = (steps: number, position = 2) =>
    ({
      routineStep: {
        findUnique: vi.fn(async () => ({ position })),
        count: vi.fn(async (_args: unknown) => steps),
      },
    }) as unknown as ExecutorDeps["prisma"] & {
      routineStep: { count: ReturnType<typeof vi.fn> };
    };

  it("is true when steps follow the one this run is, counting from step 1 for the first", async () => {
    const first = prismaWith(1);
    expect(await workflowContinuesAfter(first, { routineId: "r", routineStepId: null })).toBe(true);
    expect(first.routineStep.count.mock.calls[0]?.[0]).toMatchObject({
      where: { routineId: "r", position: { gt: 1 } },
    });
    const later = prismaWith(1, 3);
    await workflowContinuesAfter(later, { routineId: "r", routineStepId: "s3" });
    expect(later.routineStep.count.mock.calls[0]?.[0]).toMatchObject({
      where: { routineId: "r", position: { gt: 3 } },
    });
  });

  it("is false for the last step and for a run that is not part of a routine", async () => {
    expect(
      await workflowContinuesAfter(prismaWith(0), { routineId: "r", routineStepId: "s2" }),
    ).toBe(false);
    expect(
      await workflowContinuesAfter(prismaWith(5), { routineId: null, routineStepId: null }),
    ).toBe(false);
  });
});
