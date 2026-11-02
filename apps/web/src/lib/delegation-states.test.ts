import type { MessageBlock } from "@corvo/contracts";
import { describe, expect, it } from "vitest";
import { delegationKey, delegationStates } from "./delegation-states";

const sent = (toBotId: string, intent?: string): MessageBlock =>
  ({ kind: "bot_message_sent", toBotId, toBotName: toBotId, text: "x", intent }) as MessageBlock;
const received = (fromBotId: string, intent?: string): MessageBlock =>
  ({
    kind: "bot_message_received",
    fromBotId,
    fromBotName: fromBotId,
    text: "y",
    intent,
  }) as MessageBlock;
const msg = (id: string, ...blocks: MessageBlock[]) => ({ id, blocks });

describe("delegationStates", () => {
  it("marks a request waiting until the same bot sends a result", () => {
    const waiting = delegationStates([msg("m1", sent("fin", "request"))]);
    expect(waiting.get(delegationKey("m1", 0))).toBe("waiting");
    const answered = delegationStates([
      msg("m1", sent("fin", "request")),
      msg("m2", received("fin", "result")),
    ]);
    expect(answered.get(delegationKey("m1", 0))).toBe("answered");
  });

  it("treats a request with no intent as a request, and a question as awaiting an answer", () => {
    const states = delegationStates([msg("a", sent("x")), msg("b", sent("y", "question"))]);
    expect(states.get("a:0")).toBe("waiting");
    expect(states.get("b:0")).toBe("waiting");
  });

  it("does not let another bot's result answer it", () => {
    const states = delegationStates([msg("m1", sent("fin")), msg("m2", received("ops", "result"))]);
    expect(states.get("m1:0")).toBe("waiting");
  });

  it("accepts a status as an answer, but not a request or a note", () => {
    for (const [intent, expected] of [
      ["status", "answered"],
      ["request", "waiting"],
      ["fyi", "waiting"],
      [undefined, "waiting"],
    ] as const) {
      const states = delegationStates([msg("m1", sent("fin")), msg("m2", received("fin", intent))]);
      expect(states.get("m1:0"), String(intent)).toBe(expected);
    }
  });

  it("answers the oldest waiting request for a bot first", () => {
    const states = delegationStates([
      msg("m1", sent("fin")),
      msg("m2", sent("fin")),
      msg("m3", received("fin", "result")),
    ]);
    expect(states.get("m1:0")).toBe("answered");
    expect(states.get("m2:0")).toBe("waiting");
  });

  it("gives no state to an update, a result or a note the bot sent", () => {
    const states = delegationStates([
      msg("m1", sent("fin", "result"), sent("fin", "status"), sent("fin", "fyi")),
    ]);
    expect(states.size).toBe(0);
  });

  it("ignores a result that answers nothing", () => {
    expect(delegationStates([msg("m1", received("fin", "result"))]).size).toBe(0);
  });
});
