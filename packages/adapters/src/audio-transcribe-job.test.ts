import type { Actor } from "@corvo/contracts";
import type { PrismaClient } from "@corvo/db";
import { describe, expect, it, vi } from "vitest";
import {
  type AudioTranscribeJobDeps,
  createAnnouncer,
  modelDownloadNotice,
  queueChannelNotice,
  runAudioTranscribeJob,
} from "./audio-transcribe-job.js";
import type { TranscriptionOutcome } from "./audio-transcription.js";

const voice = (artifactId: string, name = "memo.ogg") => ({
  kind: "file",
  artifactId,
  name,
  mimeType: "audio/ogg",
  size: 4000,
});
const fileLine = (name: string) => `User attached file "${name}" (audio/ogg, 4000 bytes).`;

interface Setup {
  status?: string;
  blocks?: unknown[];
  prompt?: string;
  outcome?: (artifactId: string) => Promise<TranscriptionOutcome> | TranscriptionOutcome;
  announceDownload?: boolean;
  runId?: string;
}

function setup(options: Setup = {}) {
  const runId = options.runId ?? "run-1";
  const blocks = options.blocks ?? [{ kind: "text", text: "hi" }, voice("art-1")];
  const prompt = { current: options.prompt ?? `hi\n\n${fileLine("memo.ogg")}` };
  const update = vi.fn(async ({ data }: { data: { prompt: string } }) => {
    prompt.current = data.prompt;
    return {};
  });
  const runUpdate = vi.fn(async (_args: unknown) => ({}));
  const enqueue = vi.fn(async (_job: unknown) => undefined);
  const announce = vi.fn(async () => undefined);
  const transcribe = vi.fn(
    async (input: {
      artifactId: string;
      onPreparingModel?: (model: { id: string; sizeBytes: number }) => Promise<void>;
    }) => {
      if (options.announceDownload)
        await input.onPreparingModel?.({ id: "base", sizeBytes: 207_557_382 });
      return (
        (await options.outcome?.(input.artifactId)) ??
        ({ status: "transcribed", text: "olá", language: "pt" } as const)
      );
    },
  );
  const deps = {
    prisma: {
      message: { findUnique: vi.fn(async () => ({ blocks })) },
      task: { findUnique: vi.fn(async () => ({ prompt: prompt.current })), update },
      run: {
        findUnique: vi.fn(async () => ({
          id: runId,
          spaceId: "space-1",
          userId: "user-1",
          botId: "bot-1",
          threadId: "thread-1",
          taskId: "task-1",
          status: options.status ?? "queued",
          trigger: "messaging",
          sourceMessageId: "msg-1",
        })),
        update: runUpdate,
      },
    } as unknown as PrismaClient,
    jobs: { enqueue },
    transcribe,
    announce,
  } as AudioTranscribeJobDeps;
  return { deps, prompt, update, enqueue, announce, transcribe, runId, runUpdate };
}

describe("a visitor's voice note", () => {
  const visitorBlocks = [
    { kind: "text", text: "hi" },
    voice("art-1"),
    { kind: "visitor_message", installationId: "inst-1", conversationId: "conv-1" },
  ];

  it("is transcribed without being allowed to cause a download", async () => {
    const { deps, transcribe } = setup({ blocks: visitorBlocks });
    await runAudioTranscribeJob(deps, { runId: "run-1" });
    expect(transcribe).toHaveBeenCalledWith(expect.objectContaining({ noDownload: true }));
  });

  it("leaves the owner's own audio free to download", async () => {
    const { deps, transcribe } = setup();
    await runAudioTranscribeJob(deps, { runId: "run-1" });
    expect(transcribe).toHaveBeenCalledWith(expect.not.objectContaining({ noDownload: true }));
  });

  it("is attached with a note when too many are waiting on the same number, and the run still starts", async () => {
    const gate = { run: async () => "full" as const };
    const { deps, prompt, enqueue, transcribe } = setup({ blocks: visitorBlocks });
    await runAudioTranscribeJob({ ...deps, visitorGate: gate }, { runId: "run-1" });
    expect(transcribe).not.toHaveBeenCalled();
    expect(prompt.current).toContain("too many audio messages were sent at once");
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ name: "run.continue" }));
  });

  it("never parks a second job of the same number waiting for the first, which would hold a worker slot", async () => {
    let finishFirst!: () => void;
    const firstDone = new Promise<void>((resolve) => {
      finishFirst = resolve;
    });
    const slow = setup({
      blocks: visitorBlocks,
      outcome: async () => {
        await firstDone;
        return { status: "transcribed", text: "olá", language: "pt" };
      },
    });
    const second = setup({ blocks: visitorBlocks, runId: "run-2" });
    const first = runAudioTranscribeJob(slow.deps, { runId: "run-1" });
    await Promise.resolve();
    // The second returns at once, with a note, while the first is still working.
    await runAudioTranscribeJob(second.deps, { runId: "run-2" });
    expect(second.transcribe).not.toHaveBeenCalled();
    expect(second.prompt.current).toContain("too many audio messages were sent at once");
    finishFirst();
    await first;
  });

  it("goes through the gate keyed by the number, never the person", async () => {
    const keys: string[] = [];
    const gate = {
      run: async <T>(key: string, task: () => Promise<T>) => (keys.push(key), task()),
    };
    const { deps } = setup({ blocks: visitorBlocks });
    await runAudioTranscribeJob({ ...deps, visitorGate: gate }, { runId: "run-1" });
    expect(keys).toEqual(["inst-1"]);
  });

  it("keeps the transcript inside the frame the visitor's words sit in", async () => {
    const prompt = '<<<\nhi\n\nUser attached file "memo.ogg" (audio/ogg, 4000 bytes).\n>>>';
    const { deps, prompt: current } = setup({ blocks: visitorBlocks, prompt });
    await runAudioTranscribeJob(deps, { runId: "run-1" });
    expect(current.current.indexOf("Machine transcript")).toBeLessThan(
      current.current.lastIndexOf(">>>"),
    );
  });
});

describe("runAudioTranscribeJob", () => {
  it("releases the run with the transcript in its prompt, right after the file line", async () => {
    const { deps, prompt, enqueue } = setup();
    await runAudioTranscribeJob(deps, { runId: "run-1" });
    expect(prompt.current).toBe(
      `hi\n\n${fileLine("memo.ogg")}\n\nMachine transcript of "memo.ogg" (pt), may contain errors:\nolá`,
    );
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ name: "run.continue", payload: { runId: "run-1" } }),
    );
  });

  it("a failure releases the run with a 'not transcribed' note, never leaves it stuck", async () => {
    const { deps, prompt, enqueue } = setup({
      outcome: () => ({ status: "failed", reason: "no-speech" }),
    });
    await runAudioTranscribeJob(deps, { runId: "run-1" });
    expect(prompt.current).toContain('Audio "memo.ogg" was not transcribed (no speech was heard).');
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("a transcription that throws still releases the run, with a provider-failed note", async () => {
    const { deps, prompt, enqueue } = setup({
      outcome: () => {
        throw new Error("database went away");
      },
    });
    await runAudioTranscribeJob(deps, { runId: "run-1" });
    expect(prompt.current).toContain("was not transcribed");
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("transcribes only audio files, in order, one note each", async () => {
    const { deps, prompt, transcribe } = setup({
      blocks: [
        { kind: "text", text: "hi" },
        voice("art-1", "a.ogg"),
        { kind: "image", artifactId: "img-1", mimeType: "image/png", name: "p.png" },
        { kind: "file", artifactId: "pdf-1", name: "r.pdf", mimeType: "application/pdf", size: 9 },
        voice("art-2", "b.ogg"),
      ],
      prompt: `hi\n\n${fileLine("a.ogg")}\n\n${fileLine("b.ogg")}`,
    });
    await runAudioTranscribeJob(deps, { runId: "run-1" });
    expect(transcribe.mock.calls.map(([input]) => input.artifactId)).toEqual(["art-1", "art-2"]);
    expect(prompt.current.indexOf('"a.ogg" (pt)')).toBeLessThan(
      prompt.current.indexOf(fileLine("b.ogg")),
    );
  });

  it("clears the hold on the run before starting it, and only for a run that was waiting", async () => {
    const waiting = setup();
    await runAudioTranscribeJob(waiting.deps, { runId: "run-1" });
    expect(waiting.runUpdate).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: { awaitingAudioAt: null },
    });
    const cancelled = setup({ status: "cancelled" });
    await runAudioTranscribeJob(cancelled.deps, { runId: "run-1" });
    expect(cancelled.runUpdate).not.toHaveBeenCalled();
  });

  it("a run without audio is released untouched", async () => {
    const { deps, update, enqueue, transcribe } = setup({ blocks: [{ kind: "text", text: "hi" }] });
    await runAudioTranscribeJob(deps, { runId: "run-1" });
    expect(transcribe).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("does nothing for a run that is no longer waiting", async () => {
    const { deps, update, enqueue, transcribe } = setup({ status: "cancelled" });
    await runAudioTranscribeJob(deps, { runId: "run-1" });
    expect(transcribe).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("a repeated job does not add the note again, and still names one run job", async () => {
    const { deps, prompt, update, enqueue } = setup();
    await runAudioTranscribeJob(deps, { runId: "run-1" });
    const once = prompt.current;
    await runAudioTranscribeJob(deps, { runId: "run-1" });
    expect(prompt.current).toBe(once);
    expect(update).toHaveBeenCalledTimes(1);
    const keys = enqueue.mock.calls.map(([job]) => (job as { replaceKey?: string }).replaceKey);
    expect(new Set(keys).size).toBe(1);
  });

  it("announces a model download once, with its size, however many audios wait", async () => {
    const { deps, announce } = setup({
      blocks: [voice("art-1", "a.ogg"), voice("art-2", "b.ogg")],
      prompt: `${fileLine("a.ogg")}\n\n${fileLine("b.ogg")}`,
      announceDownload: true,
    });
    await runAudioTranscribeJob(deps, { runId: "run-1" });
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(
      expect.objectContaining({ id: "run-1" }),
      modelDownloadNotice(207_557_382),
    );
    expect(modelDownloadNotice(207_557_382)).toContain("208 MB");
  });

  it("two runs waiting on one download are each released when it finishes", async () => {
    let finish: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const first = setup({
      runId: "run-1",
      outcome: async () => {
        await gate;
        return { status: "transcribed", text: "um" } as const;
      },
    });
    const second = setup({
      runId: "run-2",
      outcome: async () => {
        await gate;
        return { status: "transcribed", text: "dois" } as const;
      },
    });
    const both = Promise.all([
      runAudioTranscribeJob(first.deps, { runId: "run-1" }),
      runAudioTranscribeJob(second.deps, { runId: "run-2" }),
    ]);
    expect(first.enqueue).not.toHaveBeenCalled();
    expect(second.enqueue).not.toHaveBeenCalled();
    finish();
    await both;
    expect(first.prompt.current).toContain("um");
    expect(second.prompt.current).toContain("dois");
    expect(first.enqueue).toHaveBeenCalledTimes(1);
    expect(second.enqueue).toHaveBeenCalledTimes(1);
  });
});

describe("queueChannelNotice", () => {
  const run = { id: "run-1", botId: "bot-1", trigger: "messaging", sourceMessageId: "msg-1" };

  function channelDeps(over: { identity?: unknown; blocks?: unknown[] } = {}) {
    const createMany = vi.fn(async () => ({ count: 1 }));
    const enqueue = vi.fn(async () => undefined);
    const prisma = {
      messagingIdentity: {
        findUnique: vi.fn(async () =>
          over.identity === undefined ? { id: "ident-1" } : over.identity,
        ),
      },
      message: {
        findUnique: vi.fn(async () => ({ blocks: over.blocks ?? [{ kind: "text", text: "hi" }] })),
      },
      messagingOutbound: { createMany },
    } as unknown as PrismaClient;
    return { deps: { prisma, jobs: { enqueue } }, createMany, enqueue };
  }

  it("queues one direct message to the sender, once per run, and starts delivery", async () => {
    const { deps, createMany, enqueue } = channelDeps();
    await queueChannelNotice(deps, run, "Downloading the speech model.");
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          idempotencyKey: "audio-status:run-1",
          kind: "dm",
          identityId: "ident-1",
          body: "Downloading the speech model.",
        },
      ],
      skipDuplicates: true,
    });
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ name: "messaging.deliver" }));
  });

  it("says nothing in a group channel, for an in-app run, or without a linked identity", async () => {
    const group = channelDeps({
      blocks: [{ kind: "channel_message", channelId: "c1", text: "x" }],
    });
    await queueChannelNotice(group.deps, run, "x");
    const inApp = channelDeps();
    await queueChannelNotice(inApp.deps, { ...run, trigger: "user" }, "x");
    const none = channelDeps({ identity: null });
    await queueChannelNotice(none.deps, run, "x");
    for (const { createMany, enqueue } of [group, inApp, none]) {
      expect(createMany).not.toHaveBeenCalled();
      expect(enqueue).not.toHaveBeenCalled();
    }
  });
});

void ({} as Actor);

describe("createAnnouncer", () => {
  it("posts the notice in the conversation as a system message, then to the chat app", async () => {
    const publish = vi.fn(async () => null);
    const createMany = vi.fn(async () => ({ count: 1 }));
    const deps = {
      prisma: {
        messagingIdentity: { findUnique: vi.fn(async () => ({ id: "ident-1" })) },
        message: { findUnique: vi.fn(async () => ({ blocks: [] })) },
        messagingOutbound: { createMany },
      },
      events: {},
      jobs: { enqueue: vi.fn(async () => undefined) },
    } as unknown as Parameters<typeof createAnnouncer>[0];
    const run = {
      id: "run-1",
      spaceId: "s",
      threadId: "t",
      botId: "b",
      trigger: "messaging",
      sourceMessageId: "m",
    };
    await createAnnouncer(deps, publish as never)(run, "Downloading.");
    expect(publish).toHaveBeenCalledWith(deps, run, "system", [
      { kind: "text", text: "Downloading." },
    ]);
    expect(createMany).toHaveBeenCalledTimes(1);
  });
});
