import type { JobPublisher } from "@corvo/adapter-kit";
import { messagingDeliverJob, runContinueJob } from "@corvo/adapter-kit";
import type { Actor } from "@corvo/contracts";
import { isAttachmentAudioMimeType } from "@corvo/contracts";
import { insertAttachmentNotes } from "@corvo/core";
import type { PrismaClient, ThreadEvents } from "@corvo/db";
import { getLogger } from "@corvo/logging";
import type { TranscriptionOutcome } from "./audio-transcription.js";
import { transcriptNote } from "./audio-transcription.js";
import { publishMessage } from "./run-messages.js";

/** The parts of a run the job and its notices need. */
export interface AnnouncedRun {
  id: string;
  spaceId: string;
  threadId: string;
  botId: string;
  trigger: string;
  sourceMessageId: string | null;
}

export interface AudioTranscribeJobDeps {
  prisma: PrismaClient;
  jobs: Pick<JobPublisher, "enqueue">;
  transcribe(input: {
    artifactId: string;
    actor: Actor;
    onPreparingModel: (model: { id: string; sizeBytes: number }) => Promise<void>;
  }): Promise<TranscriptionOutcome>;
  /** Tells the owner a model is being fetched: in the conversation and, for a chat app, there. */
  announce(run: AnnouncedRun, text: string): Promise<void>;
}

/** One short line: the owner sees why nothing has happened yet. */
export function modelDownloadNotice(sizeBytes: number): string {
  return `Downloading the speech model (${Math.round(sizeBytes / 1_000_000)} MB) to transcribe your audio.`;
}

type FileBlock = { kind: "file"; artifactId: string; name: string; mimeType: string; size: number };

function audioFileBlocks(blocks: unknown): FileBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.filter(
    (block): block is FileBlock =>
      block?.kind === "file" &&
      typeof block.artifactId === "string" &&
      typeof block.mimeType === "string" &&
      isAttachmentAudioMimeType(block.mimeType),
  );
}

const unavailable: TranscriptionOutcome = { status: "failed", reason: "provider-failed" };

/**
 * Transcribes the audio of a run's message, puts each transcript into the task prompt after its
 * file line, and starts the run. The run is always started: an audio that could not be read is
 * reported to the agent in its place, and a stuck run would be worse. A run that is no longer
 * waiting is left alone, and the transcripts are stored, so a repeat changes nothing.
 */
export async function runAudioTranscribeJob(
  deps: AudioTranscribeJobDeps,
  payload: { runId: string },
): Promise<void> {
  const run = await deps.prisma.run.findUnique({
    where: { id: payload.runId },
    select: {
      id: true,
      spaceId: true,
      userId: true,
      botId: true,
      threadId: true,
      taskId: true,
      status: true,
      trigger: true,
      sourceMessageId: true,
    },
  });
  if (run?.status !== "queued") return;
  const actor = { spaceId: run.spaceId, userId: run.userId } as Actor;
  const message = run.sourceMessageId
    ? await deps.prisma.message.findUnique({
        where: { id: run.sourceMessageId },
        select: { blocks: true },
      })
    : null;
  const notes: Array<{ name: string; mimeType: string; size: number; note: string }> = [];
  let announced = false;
  for (const block of audioFileBlocks(message?.blocks)) {
    const outcome = await deps
      .transcribe({
        artifactId: block.artifactId,
        actor,
        onPreparingModel: async ({ sizeBytes }) => {
          if (announced) return;
          announced = true;
          await deps.announce(run, modelDownloadNotice(sizeBytes)).catch((error: unknown) => {
            getLogger().warn("audio transcription notice failed", {
              reason: error instanceof Error ? error.message : String(error),
            });
          });
        },
      })
      .catch((error: unknown) => {
        getLogger().error("audio transcription failed", error);
        return unavailable;
      });
    notes.push({
      name: block.name,
      mimeType: block.mimeType,
      size: block.size,
      note: transcriptNote(block.name, outcome),
    });
  }
  try {
    const task = notes.length
      ? await deps.prisma.task.findUnique({ where: { id: run.taskId }, select: { prompt: true } })
      : null;
    if (task) {
      const prompt = insertAttachmentNotes(task.prompt, notes);
      if (prompt !== task.prompt) {
        await deps.prisma.task.update({ where: { id: run.taskId }, data: { prompt } });
      }
    }
  } catch (error) {
    getLogger().error("audio transcript could not be added to the prompt", error);
  }
  await deps.prisma.run
    .update({ where: { id: run.id }, data: { awaitingAudioAt: null } })
    .catch((error: unknown) => {
      getLogger().warn("audio hold could not be cleared", {
        reason: error instanceof Error ? error.message : String(error),
      });
    });
  await deps.jobs.enqueue(runContinueJob(run.id));
}

/**
 * One direct message to the person who sent the audio from a chat app, so they see why the answer
 * is slow. Group channels have their own attribution and fan-out, and in-app runs show the notice
 * in the conversation, so neither gets one. A run keys its own notice, so a repeat sends nothing.
 */
export async function queueChannelNotice(
  deps: { prisma: PrismaClient; jobs: Pick<JobPublisher, "enqueue"> },
  run: Pick<AnnouncedRun, "id" | "botId" | "trigger" | "sourceMessageId">,
  text: string,
): Promise<void> {
  if (run.trigger !== "messaging") return;
  const source = run.sourceMessageId
    ? await deps.prisma.message.findUnique({
        where: { id: run.sourceMessageId },
        select: { blocks: true },
      })
    : null;
  const blocks = Array.isArray(source?.blocks) ? (source.blocks as Array<{ kind?: string }>) : [];
  if (blocks.some((block) => block.kind === "channel_message")) return;
  const identity = await deps.prisma.messagingIdentity.findUnique({
    where: { botId: run.botId },
    select: { id: true },
  });
  if (!identity) return;
  await deps.prisma.messagingOutbound.createMany({
    data: [
      { idempotencyKey: `audio-status:${run.id}`, kind: "dm", identityId: identity.id, body: text },
    ],
    skipDuplicates: true,
  });
  await deps.jobs.enqueue(messagingDeliverJob());
}

/** The notice, in the conversation and in the chat app it came from. */
export function createAnnouncer(
  deps: { prisma: PrismaClient; events: ThreadEvents; jobs: Pick<JobPublisher, "enqueue"> },
  publish: typeof publishMessage = publishMessage,
) {
  return async (run: AnnouncedRun, text: string): Promise<void> => {
    await publish(deps, run, "system", [{ kind: "text", text }]);
    await queueChannelNotice(deps, run, text);
  };
}
