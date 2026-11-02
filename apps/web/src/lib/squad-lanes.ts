import type { GroupMember, MessageBlock, ThreadMessage } from "@corvo/contracts";
import { isRunWorking } from "@corvo/core";

export type SquadLaneState = "waiting" | "working" | "done";

export type SquadLane = {
  botId: string;
  name: string;
  color: string;
  state: SquadLaneState;
  /** The last few tool steps of the bot's latest message. */
  activity: string[];
  /** The latest handoff this bot received, if any. */
  handoffIn: { fromBotId: string; text: string; reason?: string } | null;
};

type Handoff = Extract<MessageBlock, { kind: "handoff" }>;
type Input = { members: readonly GroupMember[]; messages: readonly ThreadMessage[] };

const ACTIVITY_LINES = 3;

function handoffsOf(messages: readonly ThreadMessage[]) {
  return messages.flatMap((message) =>
    message.blocks
      .filter((block): block is Handoff => block.kind === "handoff")
      .map((block) => ({ seq: message.seq, block })),
  );
}

function activityOf(botId: string, messages: readonly ThreadMessage[]): string[] {
  const latest = messages.findLast(
    (message) => message.botId === botId && message.blocks.some((block) => block.kind === "steps"),
  );
  const steps =
    latest?.blocks.flatMap((block) => (block.kind === "steps" ? block.steps : [])) ?? [];
  return steps
    .slice(-ACTIVITY_LINES)
    .map((step) => (step.count > 1 ? `${step.label} ×${step.count}` : step.label));
}

/** One lane per member, in the order bots first received work, with uninvolved bots last. */
export function buildSquadLanes({ members, messages }: Input): SquadLane[] {
  const handoffs = handoffsOf(messages);
  const memberIds = new Set(members.map((member) => member.botId));
  const firstReceived = new Map<string, number>();
  const latestReceived = new Map<string, { seq: number; block: Handoff }>();
  for (const handoff of handoffs) {
    const to = handoff.block.toBotId;
    if (!memberIds.has(to)) continue;
    if (!firstReceived.has(to)) firstReceived.set(to, handoff.seq);
    latestReceived.set(to, handoff);
  }
  const rank = (botId: string) => firstReceived.get(botId) ?? Number.POSITIVE_INFINITY;
  const ordered = members
    .map((member, index) => ({ member, index }))
    .sort((a, b) => rank(a.member.botId) - rank(b.member.botId) || a.index - b.index);
  return ordered.map(({ member }) => {
    const incoming = latestReceived.get(member.botId);
    const posted = messages.some(
      (message) =>
        message.role === "bot" &&
        message.botId === member.botId &&
        message.seq > (incoming?.seq ?? -1) &&
        !message.blocks.every(
          (block) => block.kind === "handoff" && block.toBotId === member.botId,
        ),
    );
    const state: SquadLaneState = isRunWorking(member.status ?? "idle")
      ? "working"
      : posted && (incoming || messages.some((message) => message.botId === member.botId))
        ? "done"
        : "waiting";
    return {
      botId: member.botId,
      name: member.name,
      color: member.color,
      state,
      activity: activityOf(member.botId, messages),
      handoffIn: incoming
        ? {
            fromBotId: incoming.block.fromBotId,
            text: incoming.block.text,
            ...(incoming.block.reason ? { reason: incoming.block.reason } : {}),
          }
        : null,
    };
  });
}

/** The bot outside the squad that last sent it work, with what it said and why. */
export function squadRouter({
  members,
  messages,
}: Input): { botId: string; text: string; reason?: string } | null {
  const memberIds = new Set(members.map((member) => member.botId));
  const latest = handoffsOf(messages).findLast(({ block }) => !memberIds.has(block.fromBotId));
  if (!latest) return null;
  return {
    botId: latest.block.fromBotId,
    text: latest.block.text,
    ...(latest.block.reason ? { reason: latest.block.reason } : {}),
  };
}
