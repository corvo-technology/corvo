import { describe, expect, it, vi } from "vitest";
import type { EvalJudge } from "./judge.js";
import {
  gradeSquadRouting,
  SQUAD_ROUTING_CASES,
  SQUAD_ROUTING_RUBRIC_VERSION,
  type SquadRoutingCase,
  squadRoutingEvidence,
} from "./squad-routing.js";

const clear = SQUAD_ROUTING_CASES.find((c) => c.expected.kind === "route")!;
const ambiguous = SQUAD_ROUTING_CASES.find((c) => c.expected.kind === "ask")!;
const noFit = SQUAD_ROUTING_CASES.find((c) => c.expected.kind === "none")!;
const expectedGroup = (c: SquadRoutingCase) =>
  c.expected.kind === "route" ? c.expected.groupId : "";

const passing: EvalJudge = async () => ({ pass: true, reason: "fits the purpose" });
const signal = new AbortController().signal;

describe("squad routing cases", () => {
  it("covers a clear request, an ambiguous one and one with no fit", () => {
    expect(new Set(SQUAD_ROUTING_CASES.map((c) => c.expected.kind))).toEqual(
      new Set(["route", "ask", "none"]),
    );
  });

  it("has unique ids and only expects squads that exist in the case", () => {
    const ids = SQUAD_ROUTING_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of SQUAD_ROUTING_CASES) {
      if (c.expected.kind === "route") {
        expect(c.squads.map((squad) => squad.id)).toContain(c.expected.groupId);
      }
    }
  });
});

describe("gradeSquadRouting observable effect", () => {
  it("passes a handoff to the expected squad that gives a reason", async () => {
    const result = await gradeSquadRouting(clear, {
      kind: "handoff",
      groupId: expectedGroup(clear),
      reason: "It is about a landing page",
    });
    expect(result.status).toBe("pass");
  });

  it("fails a handoff to the wrong squad", async () => {
    const wrong = clear.squads.find((squad) => squad.id !== expectedGroup(clear))!;
    const result = await gradeSquadRouting(clear, {
      kind: "handoff",
      groupId: wrong.id,
      reason: "x",
    });
    expect(result.status).toBe("fail");
  });

  it("fails a handoff that gives no reason", async () => {
    const result = await gradeSquadRouting(clear, {
      kind: "handoff",
      groupId: expectedGroup(clear),
    });
    expect(result.status).toBe("fail");
  });

  it("expects a question, not a guess, when two squads fit equally", async () => {
    expect(
      (await gradeSquadRouting(ambiguous, { kind: "ask", question: "Which squad?" })).status,
    ).toBe("pass");
    expect(
      (
        await gradeSquadRouting(ambiguous, {
          kind: "handoff",
          groupId: ambiguous.squads[0]!.id,
          reason: "guess",
        })
      ).status,
    ).toBe("fail");
  });

  it("expects no handoff when no squad fits", async () => {
    expect((await gradeSquadRouting(noFit, { kind: "none" })).status).toBe("pass");
    expect(
      (
        await gradeSquadRouting(noFit, {
          kind: "handoff",
          groupId: noFit.squads[0]!.id,
          reason: "closest",
        })
      ).status,
    ).toBe("fail");
  });
});

describe("gradeSquadRouting judged reason", () => {
  const outcome = () => ({
    kind: "handoff" as const,
    groupId: expectedGroup(clear),
    reason: "It is about a landing page",
  });

  it("sends the judge the versioned rubric and the squads, request and reason", async () => {
    const judge = vi.fn(passing);
    await gradeSquadRouting(clear, outcome(), { judge, signal });
    const input = judge.mock.calls[0]![0];
    expect(input.rubric).toContain(SQUAD_ROUTING_RUBRIC_VERSION);
    expect(JSON.stringify(input.evidence)).toContain(clear.request);
    expect(JSON.stringify(input.evidence)).toContain(clear.squads[0]!.purpose);
    expect(JSON.stringify(input.evidence)).toContain("It is about a landing page");
  });

  it("passes when the judge accepts the reason", async () => {
    expect((await gradeSquadRouting(clear, outcome(), { judge: passing, signal })).status).toBe(
      "pass",
    );
  });

  it("fails when the judge rejects the reason", async () => {
    const judge: EvalJudge = async () => ({ pass: false, reason: "unrelated" });
    const result = await gradeSquadRouting(clear, outcome(), { judge, signal });
    expect(result.status).toBe("fail");
  });

  it("is unqualified, not a pass, when the judge errors", async () => {
    const judge: EvalJudge = async () => {
      throw new Error("provider down");
    };
    const result = await gradeSquadRouting(clear, outcome(), { judge, signal });
    expect(result.status).toBe("unqualified");
  });

  it("does not call the judge when the observable effect already failed", async () => {
    const judge = vi.fn(passing);
    const wrong = clear.squads.find((squad) => squad.id !== expectedGroup(clear))!;
    await gradeSquadRouting(
      clear,
      { kind: "handoff", groupId: wrong.id, reason: "x" },
      { judge, signal },
    );
    expect(judge).not.toHaveBeenCalled();
  });

  it("builds evidence from the case and outcome only", () => {
    expect(squadRoutingEvidence(clear, outcome())).toMatchObject({
      request: clear.request,
      squads: clear.squads,
      reason: "It is about a landing page",
    });
  });
});
