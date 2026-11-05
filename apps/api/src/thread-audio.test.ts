import type { PrismaClient } from "@corvo/db";
import { describe, expect, it, vi } from "vitest";
import { enqueueRunsNeedingContinue } from "./thread-target.js";

const actor = { spaceId: "space-1", userId: "user-1" };

function setup() {
  const update = vi.fn(async (_args: unknown) => ({}));
  const enqueue = vi.fn(async (_job: unknown) => undefined);
  const audio = { canTranscribe: vi.fn(async () => true) };
  return {
    deps: {
      jobs: { enqueue },
      prisma: {
        run: {
          update,
          findUnique: vi.fn(async () => ({ sourceMessageId: "msg-1", status: "queued" })),
        },
      } as unknown as PrismaClient,
      audio,
    },
    enqueue,
    update,
  };
}

describe("enqueueRunsNeedingContinue", () => {
  it("holds each queued run of a message that carries the owner's voice note", async () => {
    const { deps, enqueue } = setup();
    await enqueueRunsNeedingContinue(
      deps,
      [
        { id: "run-1", status: "queued" },
        { id: "run-2", status: "queued" },
      ],
      { actor, messageId: "msg-1", attachments: [{ mimeType: "audio/ogg" }] },
    );
    const names = enqueue.mock.calls.map(([job]) => (job as { name: string }).name);
    expect(names).toEqual(["audio.transcribe", "audio.transcribe"]);
  });

  it("is unchanged without audio, and skips runs that need no wake", async () => {
    const { deps, enqueue } = setup();
    await enqueueRunsNeedingContinue(
      deps,
      [
        { id: "run-1", status: "queued" },
        { id: "run-2", status: "completed" },
      ],
      { actor, messageId: "msg-1", attachments: [{ mimeType: "image/png" }] },
    );
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ name: "run.continue", payload: { runId: "run-1" } }),
    );
  });

  it("keeps working with the jobs-only form other callers use", async () => {
    const { deps, enqueue } = setup();
    await enqueueRunsNeedingContinue({ jobs: deps.jobs }, [{ id: "run-1", status: "queued" }]);
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ name: "run.continue" }));
  });
});
