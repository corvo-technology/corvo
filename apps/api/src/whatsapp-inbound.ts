import type { JobPublisher, MessagingInboundMessage } from "@corvo/adapter-kit";
import {
  messageBlockForArtifact,
  promptTextForAttachments,
  visitorMessagePrompt,
} from "@corvo/core";
import type { PrismaClient, ThreadEvents } from "@corvo/db";
import { runAsSystem } from "@corvo/db";
import { getLogger } from "@corvo/logging";
import type { AudioHold } from "./audio-hold.js";
import { startRunOrAwaitAudio } from "./audio-hold.js";
import { type MessagingInboundDeps, storeInboundMedia } from "./messaging-inbound.js";

const PROVIDER = "whatsapp-web";

export interface WhatsAppInboundDeps {
  prisma: PrismaClient;
  events: Pick<ThreadEvents, "sendUserMessage">;
  jobs: Pick<JobPublisher, "enqueue">;
  audio?: AudioHold;
  storeAttachment?: MessagingInboundDeps["storeAttachment"];
  /** False drops a visitor's message without a run: the per-sender and per-number limit. */
  allowRun?: (installationId: string, senderId: string) => boolean;
}

/** "whatsapp-web:<installation>:<chat>" → the chat id. */
function chatIdOf(threadId: string): string {
  const rest = threadId.slice(PROVIDER.length + 1);
  return rest.slice(rest.indexOf(":") + 1);
}

/**
 * Routes what the linked-number surface emits. The owner's own chat is the owner talking to the
 * agent. Everyone else is a visitor with a conversation and thread of their own, whose run is
 * marked so the executor offers it only the tools the owner ticked.
 */
export function createWhatsAppInboundHandler(deps: WhatsAppInboundDeps) {
  return async (event: MessagingInboundMessage): Promise<void> => {
    if (event.provider !== PROVIDER || !event.installationId || !event.audience) return;
    const installation = await runAsSystem("read linked whatsapp number", () =>
      deps.prisma.messagingInstallation.findUnique({
        where: { id: event.installationId },
        select: { id: true, userId: true, spaceId: true, botId: true, status: true },
      }),
    );
    if (installation?.status !== "active") return;
    if (event.audience === "owner") return handleOwner(deps, installation, event);
    if (event.audience === "visitor") return handleVisitor(deps, installation, event);
    return handleRecord(deps, installation, event);
  };
}

type Installation = { id: string; userId: string; spaceId: string; botId: string };

async function handleOwner(
  deps: WhatsAppInboundDeps,
  installation: Installation,
  event: MessagingInboundMessage,
) {
  const thread = await deps.prisma.thread.findFirst({
    where: { botId: installation.botId },
    select: { id: true },
  });
  if (!thread) throw new Error(`whatsapp number ${installation.id} has no thread for its agent`);
  const ids = {
    spaceId: installation.spaceId,
    userId: installation.userId,
    botId: installation.botId,
  };
  const stored = await storeInboundMedia(deps, ids as never, event);
  const body = [event.content, ...stored.unavailable].filter(Boolean).join("\n");
  const sent = await deps.events.sendUserMessage({
    ...ids,
    threadId: thread.id,
    blocks: [
      ...(body ? [{ kind: "text" as const, text: body }] : []),
      ...stored.artifacts.map((artifact) => messageBlockForArtifact(artifact)),
    ],
    prompt: promptTextForAttachments(body, stored.artifacts),
    trigger: "messaging",
    clientNonce: `${PROVIDER}:${installation.id}:${event.handle}`,
  });
  if (!sent.runId) return;
  await startRunOrAwaitAudio(
    { jobs: deps.jobs, prisma: deps.prisma, audio: deps.audio },
    {
      runId: sent.runId,
      messageId: sent.messageId,
      actor: { spaceId: installation.spaceId, userId: installation.userId },
      fromOwner: true,
      attachments: stored.artifacts,
    },
  ).catch((error) => getLogger().error("whatsapp owner run enqueue error", error));
}

async function upsertConversation(
  deps: WhatsAppInboundDeps,
  installation: Installation,
  event: MessagingInboundMessage,
) {
  const chatId = chatIdOf(event.threadId);
  return deps.prisma.externalConversation.upsert({
    where: {
      provider_workspaceId_externalKey: {
        provider: PROVIDER,
        workspaceId: installation.id,
        externalKey: chatId,
      },
    },
    create: {
      provider: PROVIDER,
      workspaceId: installation.id,
      externalKey: chatId,
      conversationId: event.threadId,
      displayName: event.fromLabel,
      participantNames: [],
      spaceId: installation.spaceId,
      botId: installation.botId,
      userId: installation.userId,
      thread: { create: { spaceId: installation.spaceId, userId: installation.userId } },
    },
    update: { conversationId: event.threadId },
    include: { thread: { select: { id: true } } },
  });
}

async function handleVisitor(
  deps: WhatsAppInboundDeps,
  installation: Installation,
  event: MessagingInboundMessage,
) {
  if (deps.allowRun && !deps.allowRun(installation.id, event.from)) return;
  const conversation = await upsertConversation(deps, installation, event);
  if (!conversation.thread) throw new Error("whatsapp conversation has no thread");
  // A conversation stays with the agent that had it, even if the number has moved to another.
  const ids = {
    spaceId: conversation.spaceId,
    userId: conversation.userId,
    botId: conversation.botId,
  };
  const stored = await storeInboundMedia(deps, ids as never, event);
  const body = [event.content, ...stored.unavailable].filter(Boolean).join("\n");
  const sent = await deps.events.sendUserMessage({
    ...ids,
    threadId: conversation.thread.id,
    blocks: [
      ...(body ? [{ kind: "text" as const, text: body }] : []),
      ...stored.artifacts.map((artifact) => messageBlockForArtifact(artifact)),
      {
        kind: "visitor_message" as const,
        installationId: installation.id,
        conversationId: conversation.id,
      },
    ],
    // Everything the visitor controls, file names included, sits inside the frame.
    prompt: visitorMessagePrompt({
      fromLabel: event.fromLabel ?? "someone",
      text: promptTextForAttachments(body, stored.artifacts),
    }),
    trigger: "messaging",
    clientNonce: `${PROVIDER}:${installation.id}:${event.handle}`,
  });
  if (!sent.runId) return;
  await startRunOrAwaitAudio(
    { jobs: deps.jobs, prisma: deps.prisma, audio: deps.audio },
    {
      runId: sent.runId,
      messageId: sent.messageId,
      actor: { spaceId: ids.spaceId, userId: ids.userId },
      fromOwner: false,
      attachments: stored.artifacts,
    },
  ).catch((error) => getLogger().error("whatsapp visitor run enqueue error", error));
}

/**
 * Old, late and paused-time messages are shown in a conversation that already exists and never
 * answered. A history sync must not create a thread for every chat the number ever had.
 */
async function handleRecord(
  deps: WhatsAppInboundDeps,
  installation: Installation,
  event: MessagingInboundMessage,
) {
  const conversation = await deps.prisma.externalConversation.findUnique({
    where: {
      provider_workspaceId_externalKey: {
        provider: PROVIDER,
        workspaceId: installation.id,
        externalKey: chatIdOf(event.threadId),
      },
    },
    include: { thread: { select: { id: true } } },
  });
  if (!conversation?.thread) return;
  await deps.events.sendUserMessage({
    spaceId: conversation.spaceId,
    userId: conversation.userId,
    botId: conversation.botId,
    threadId: conversation.thread.id,
    blocks: [{ kind: "text" as const, text: event.content }],
    prompt: event.content,
    trigger: "messaging",
    clientNonce: `${PROVIDER}:rec:${installation.id}:${event.handle}`,
    createRun: false,
  });
}
