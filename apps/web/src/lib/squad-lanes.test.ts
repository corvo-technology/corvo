import type { GroupMember, ThreadMessage } from "@corvo/contracts";
import { describe, expect, it } from "vitest";
import { buildSquadLanes, squadRouter } from "./squad-lanes";

const member = (botId: string, status = "idle"): GroupMember => ({
  botId,
  name: botId.toUpperCase(),
  color: "blue",
  status,
});

let seq = 0;
function message(
  botId: string | undefined,
  blocks: ThreadMessage["blocks"],
  role: ThreadMessage["role"] = "bot",
): ThreadMessage {
  seq += 1;
  return {
    id: `m${seq}`,
    threadId: "t",
    seq,
    role,
    blocks,
    botId,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}
const handoff = (from: string, to: string, text: string, reason?: string) =>
  message(from, [
    { kind: "handoff", fromBotId: from, toBotId: to, text, ...(reason ? { reason } : {}) },
  ]);
const said = (botId: string, text = "ok") => message(botId, [{ kind: "text", text }]);

describe("buildSquadLanes", () => {
  it("orders lanes by when each bot first received work, with uninvolved bots last", () => {
    const lanes = buildSquadLanes({
      members: [member("copy"), member("design"), member("research"), member("idle")],
      messages: [handoff("chief", "research", "Read it"), handoff("research", "design", "Review")],
    });
    expect(lanes.map((lane) => lane.botId)).toEqual(["research", "design", "copy", "idle"]);
  });

  it("marks a bot with an active run as working", () => {
    const [lane] = buildSquadLanes({ members: [member("design", "running")], messages: [] });
    expect(lane?.state).toBe("working");
  });

  it("marks a bot that received work and then posted as done", () => {
    const [lane] = buildSquadLanes({
      members: [member("design")],
      messages: [handoff("chief", "design", "Review"), said("design")],
    });
    expect(lane?.state).toBe("done");
  });

  it("keeps a bot that received work but has not posted as waiting", () => {
    const [lane] = buildSquadLanes({
      members: [member("design")],
      messages: [handoff("chief", "design", "Review")],
    });
    expect(lane?.state).toBe("waiting");
  });

  it("carries the latest handoff into a lane with its text and reason", () => {
    const lanes = buildSquadLanes({
      members: [member("design")],
      messages: [
        handoff("chief", "design", "First", "old"),
        handoff("research", "design", "Second", "Fits a landing review"),
      ],
    });
    expect(lanes[0]?.handoffIn).toEqual({
      fromBotId: "research",
      text: "Second",
      reason: "Fits a landing review",
    });
  });

  it("lists the last tool steps of the bot's latest message, with repeat counts", () => {
    const lanes = buildSquadLanes({
      members: [member("research", "running")],
      messages: [
        message("research", [
          { kind: "steps", steps: [{ label: "old", count: 1 }] },
          { kind: "text", text: "x" },
        ]),
        message("research", [
          {
            kind: "steps",
            steps: [
              { label: "browser", count: 3 },
              { label: "read", count: 1 },
              { label: "search", count: 1 },
              { label: "write", count: 1 },
            ],
          },
        ]),
      ],
    });
    expect(lanes[0]?.activity).toEqual(["read", "search", "write"]);
  });

  it("shows a repeat count when a step ran more than once", () => {
    const lanes = buildSquadLanes({
      members: [member("research", "running")],
      messages: [message("research", [{ kind: "steps", steps: [{ label: "browser", count: 3 }] }])],
    });
    expect(lanes[0]?.activity).toEqual(["browser ×3"]);
  });

  it("ignores a handoff to a bot that is no longer a member", () => {
    const lanes = buildSquadLanes({
      members: [member("design")],
      messages: [handoff("chief", "gone", "Ghost")],
    });
    expect(lanes.map((lane) => lane.botId)).toEqual(["design"]);
  });

  it("returns one lane for a squad with one active member", () => {
    expect(buildSquadLanes({ members: [member("solo")], messages: [] })).toHaveLength(1);
  });
});

describe("squadRouter", () => {
  it("is the latest sender of a handoff who is not a member", () => {
    expect(
      squadRouter({
        members: [member("design")],
        messages: [
          handoff("chief", "design", "Review", "Fits a landing"),
          handoff("design", "design2", "x"),
        ],
      }),
    ).toEqual({ botId: "chief", text: "Review", reason: "Fits a landing" });
  });

  it("is null when only members handed work around", () => {
    expect(
      squadRouter({
        members: [member("a"), member("b")],
        messages: [handoff("a", "b", "Go")],
      }),
    ).toBeNull();
  });
});
