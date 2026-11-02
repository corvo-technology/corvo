import type { MessageBlock } from "@corvo/contracts";

export type DelegationState = "answered" | "waiting";

/** The key of one sent block, to look its state up while rendering. */
export function delegationKey(messageId: string, blockIndex: number): string {
  return `${messageId}:${blockIndex}`;
}

/**
 * Whether each request this bot sent to another bot has been answered yet. A request or question
 * waits for a result or status from the same bot; the oldest one waiting for that bot is
 * answered first. Updates and results the bot sent expect nothing back and have no state.
 */
export function delegationStates(
  messages: ReadonlyArray<{ id: string; blocks: readonly MessageBlock[] }>,
): Map<string, DelegationState> {
  const states = new Map<string, DelegationState>();
  const pending = new Map<string, string[]>();
  for (const message of messages) {
    message.blocks.forEach((block, index) => {
      if (block.kind === "bot_message_sent") {
        const intent = block.intent ?? "request";
        if (intent !== "request" && intent !== "question") return;
        const key = delegationKey(message.id, index);
        states.set(key, "waiting");
        pending.set(block.toBotId, [...(pending.get(block.toBotId) ?? []), key]);
      } else if (block.kind === "bot_message_received") {
        if (block.intent !== "result" && block.intent !== "status") return;
        const queue = pending.get(block.fromBotId);
        const answered = queue?.shift();
        if (answered) states.set(answered, "answered");
      }
    });
  }
  return states;
}
