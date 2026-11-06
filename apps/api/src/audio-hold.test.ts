import type { PrismaClient } from "@corvo/db";
import * as db from "@corvo/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAudioHold, startRunOrAwaitAudio } from "./audio-hold.js";

const actor = { spaceId: "space-1", userId: "user-1" };
const voice = { mimeType: "audio/ogg" };
const photo = { mimeType: "image/png" };

function setup(
  over: {
    canTranscribe?: boolean;
    failAudioEnqueue?: boolean;
    run?: { sourceMessageId: string | null; status: string } | null;
  } = {},
) {
  const update = vi.fn(async (_args: unknown) => ({}));
  const findUnique = vi.fn(async () =>
    over.run === undefined ? { sourceMessageId: "msg-1", status: "queued" } : over.run,
  );
  const enqueue = vi.fn(async (job: { name: string }) => {
    if (over.failAudioEnqueue && job.name === "audio.transcribe") throw new Error("queue down");
  });
  const deps = {
    prisma: { run: { update, findUnique } } as unknown as PrismaClient,
    jobs: { enqueue },
    audio: { canTranscribe: vi.fn(async () => over.canTranscribe ?? true) },
  };
  return { deps, update, enqueue };
}

const start = (
  deps: ReturnType<typeof setup>["deps"],
  input: { fromOwner?: boolean; attachments?: Array<{ mimeType: string }> } = {},
) =>
  startRunOrAwaitAudio(deps, {
    runId: "run-1",
    messageId: "msg-1",
    actor,
    fromOwner: input.fromOwner ?? true,
    attachments: input.attachments ?? [voice],
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("startRunOrAwaitAudio", () => {
  it("holds the owner's voice note: marks the run and enqueues the transcription, not the run", async () => {
    const { deps, update, enqueue } = setup();
    expect(await start(deps)).toBe("held");
    expect(update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: { awaitingAudioAt: expect.any(Date) },
    });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ name: "audio.transcribe", payload: { runId: "run-1" } }),
    );
  });

  it("starts the run at once for audio from someone else", async () => {
    const { deps, update, enqueue } = setup();
    expect(await start(deps, { fromOwner: false })).toBe("started");
    expect(update).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ name: "run.continue", payload: { runId: "run-1" } }),
    );
  });

  it("is unchanged for a message without audio, and where nothing can transcribe", async () => {
    const plain = setup();
    expect(await start(plain.deps, { attachments: [photo] })).toBe("started");
    expect(await start(plain.deps, { attachments: [] })).toBe("started");
    expect(plain.update).not.toHaveBeenCalled();
    const none = setup({ canTranscribe: false });
    expect(await start(none.deps)).toBe("started");
    expect(none.update).not.toHaveBeenCalled();
    expect(none.enqueue).toHaveBeenCalledWith(expect.objectContaining({ name: "run.continue" }));
  });

  it("is unchanged where the deployment does not wire audio at all", async () => {
    const { deps, enqueue } = setup();
    const { audio: _audio, ...bare } = deps;
    expect(
      await startRunOrAwaitAudio(bare, {
        runId: "run-1",
        actor,
        fromOwner: true,
        attachments: [voice],
      }),
    ).toBe("started");
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ name: "run.continue" }));
  });

  it("starts the run and clears the hold when the transcription cannot be queued", async () => {
    const { deps, update, enqueue } = setup({ failAudioEnqueue: true });
    expect(await start(deps)).toBe("started");
    expect(update).toHaveBeenLastCalledWith({
      where: { id: "run-1" },
      data: { awaitingAudioAt: null },
    });
    expect(enqueue).toHaveBeenLastCalledWith(expect.objectContaining({ name: "run.continue" }));
  });
});

describe("startRunOrAwaitAudio for a message that steers a run that is already going", () => {
  it("does not hold that run: it belongs to an earlier message and may be running", async () => {
    const { deps, update, enqueue } = setup({
      run: { sourceMessageId: "msg-0", status: "running" },
    });
    expect(await start(deps)).toBe("started");
    expect(update).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ name: "run.continue" }));
  });

  it("does not hold a run that is no longer waiting, even for its own message", async () => {
    const { deps, update } = setup({ run: { sourceMessageId: "msg-1", status: "running" } });
    expect(await start(deps)).toBe("started");
    expect(update).not.toHaveBeenCalled();
  });

  it("does not hold a run that cannot be found", async () => {
    const { deps, update } = setup({ run: null });
    expect(await start(deps)).toBe("started");
    expect(update).not.toHaveBeenCalled();
  });
});

describe("startRunOrAwaitAudio when the database fails", () => {
  it("still starts the run, even if clearing the hold fails too", async () => {
    const { deps, update, enqueue } = setup();
    update.mockImplementation(() => {
      throw new Error("database is down");
    });
    expect(await start(deps)).toBe("started");
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ name: "run.continue" }));
  });
});

describe("createAudioHold", () => {
  const prisma = {} as PrismaClient;

  it("can transcribe wherever the engine is the owner's own", async () => {
    const local = { store: {}, transcriber: {} } as never;
    expect(await createAudioHold({ prisma, localSpeech: local }).canTranscribe(actor)).toBe(true);
  });

  it("can transcribe with a selected provider that transcribes, and not otherwise", async () => {
    const find = vi.spyOn(db, "findDefaultVoiceCredential");
    find.mockResolvedValue({ provider: "openai" } as never);
    expect(await createAudioHold({ prisma }).canTranscribe(actor)).toBe(true);
    find.mockResolvedValue({ provider: "cartesia" } as never);
    expect(await createAudioHold({ prisma }).canTranscribe(actor)).toBe(false);
    find.mockResolvedValue(null as never);
    expect(await createAudioHold({ prisma }).canTranscribe(actor)).toBe(false);
  });
});
