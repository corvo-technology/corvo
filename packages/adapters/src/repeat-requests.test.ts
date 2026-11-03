import type { AdapterContext, DecisionProvider } from "@corvo/adapter-kit";
import { DecisionProviderError } from "@corvo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import { countRepeatedRequests, renderRepeatHint } from "./repeat-requests.js";

const context = {
  operationId: "op",
  traceId: "trace",
  spaceId: "space",
  userId: "user",
  signal: new AbortController().signal,
} as AdapterContext & { signal: AbortSignal };
const earlier = ["Send me the ClickUp summary", "ClickUp summary for today", "Draft a poem"];

function judging(answers: Record<string, [string, number | undefined]>) {
  const decide = vi.fn(async () => ({
    model: "m",
    answers: Object.fromEntries(
      Object.entries(answers).map(([key, [choice, confidence]]) => [
        key,
        { type: "choice" as const, choice, confidence },
      ]),
    ),
  }));
  return { decide } satisfies DecisionProvider;
}
const count = (provider: DecisionProvider, extra = {}) =>
  countRepeatedRequests(
    { provider, model: "m", request: "ClickUp summary please", earlier, ...extra },
    context,
  );

describe("countRepeatedRequests", () => {
  it("counts the earlier requests judged the same, asking one question for each", async () => {
    const provider = judging({
      r0: ["same", 0.9],
      r1: ["same", 0.8],
      r2: ["different", 0.9],
    });
    expect(await count(provider)).toBe(2);
    const [request] = provider.decide.mock.calls[0] as unknown as [
      { questions: Record<string, unknown> },
    ];
    expect(Object.keys(request.questions)).toEqual(["r0", "r1", "r2"]);
  });

  it("does not count an answer that is unsure or has no confidence", async () => {
    expect(await count(judging({ r0: ["same", 0.1], r1: ["same", undefined] }))).toBe(0);
  });

  it("counts nothing when there are too few earlier requests, and does not ask", async () => {
    const provider = judging({ r0: ["same", 0.9] });
    expect(await count(provider, { earlier: ["one"] })).toBe(0);
    expect(provider.decide).not.toHaveBeenCalled();
  });

  it("counts nothing when the judge fails", async () => {
    const provider = {
      decide: vi.fn(async () => {
        throw new DecisionProviderError("unavailable");
      }),
    } satisfies DecisionProvider;
    expect(await count(provider)).toBe(0);
  });
});

describe("renderRepeatHint", () => {
  it("names how many times and asks to offer once through ask_user", () => {
    const hint = renderRepeatHint(3);
    expect(hint).toContain("3 times");
    expect(hint).toContain("ask_user");
    expect(hint).toContain("Offer once");
  });
});
