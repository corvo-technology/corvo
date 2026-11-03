import type { AdapterContext, AgentRunRequest, AgentRuntime } from "@corvo/adapter-kit";
import { DecisionProviderError } from "@corvo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import { ModelDecisionProvider } from "./model-decisions.js";

const context = {
  operationId: "op",
  traceId: "trace",
  spaceId: "space",
  userId: "user",
  signal: new AbortController().signal,
} as AdapterContext;
const request = {
  model: "m",
  state: { request: "hello" },
  questions: {
    a: { type: "choice" as const, instructions: "?", criteria: { yes: "y", no: "n" } },
    b: { type: "choice" as const, instructions: "?", criteria: { yes: "y", no: "n" } },
  },
};

function providerSaying(text: string | Error) {
  const run = vi.fn(async function* (_request: unknown) {
    if (text instanceof Error) throw text;
    yield { type: "done", text };
  });
  const provider = new ModelDecisionProvider({
    runtime: { run } as unknown as AgentRuntime,
    model: { provider: "p", id: "chat-model" } as AgentRunRequest["model"],
    scope: { runId: "r", spaceId: "space", userId: "user", botId: "bot", threadId: "thread" },
  });
  return { provider, run };
}

describe("ModelDecisionProvider", () => {
  it("asks a chat model for JSON and returns the choices it names, with confidence", async () => {
    const { provider, run } = providerSaying(
      'Sure: {"answers":{"a":{"choice":"yes","confidence":0.9},"b":{"choice":"no"}}}',
    );
    expect(await provider.decide(request, context)).toEqual({
      model: "chat-model",
      answers: {
        a: { type: "choice", choice: "yes", confidence: 0.9 },
        b: { type: "choice", choice: "no" },
      },
    });
    const sent = run.mock.calls[0]?.[0] as { tools: unknown[]; prompt: string };
    expect(sent.tools).toEqual([]);
    expect(sent.prompt).toContain('"criteria"');
  });

  it("drops a choice that was not offered and a confidence outside 0 to 1", async () => {
    const { provider } = providerSaying(
      '{"answers":{"a":{"choice":"maybe","confidence":1},"b":{"choice":"no","confidence":7}}}',
    );
    expect((await provider.decide(request, context)).answers).toEqual({
      b: { type: "choice", choice: "no" },
    });
  });

  it("fails when the reply holds no usable answer, or the model errors", async () => {
    await expect(providerSaying("no idea").provider.decide(request, context)).rejects.toThrow(
      DecisionProviderError,
    );
    await expect(
      providerSaying('{"answers":{"a":{"choice":"maybe"}}}').provider.decide(request, context),
    ).rejects.toThrow(DecisionProviderError);
    await expect(
      providerSaying(new Error("boom")).provider.decide(request, context),
    ).rejects.toThrow(DecisionProviderError);
    await expect(
      providerSaying("I hit a problem: rate limited").provider.decide(request, context),
    ).rejects.toThrow(DecisionProviderError);
  });
});
