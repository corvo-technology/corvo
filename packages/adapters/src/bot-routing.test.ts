import type { AdapterContext, DecisionProvider } from "@corvo/adapter-kit";
import { DecisionProviderError } from "@corvo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import { chooseRoutingGroup, renderRoutingHint } from "./bot-routing.js";

const groups = [
  { id: "g-sales", name: "Sales", purpose: "Leads and quotes" },
  { id: "g-ops", name: "Ops", purpose: "Servers and deploys" },
];
const context = {
  operationId: "op",
  traceId: "trace",
  spaceId: "space",
  userId: "user",
  signal: new AbortController().signal,
} as AdapterContext & { signal: AbortSignal };

function providerAnswering(choice: string, confidence?: number) {
  const decide = vi.fn(async () => ({
    model: "m",
    answers: { group: { type: "choice" as const, choice, confidence } },
  }));
  return { decide } satisfies DecisionProvider;
}
const ask = (provider: DecisionProvider, extra = {}) =>
  chooseRoutingGroup(
    { provider, model: "m", request: "Quote for ACME", groups, ...extra },
    context,
  );

describe("chooseRoutingGroup", () => {
  it("returns the group the model is confident about, offering each group and a none option", async () => {
    const provider = providerAnswering("g-sales", 0.9);
    expect(await ask(provider)).toEqual(groups[0]);
    const [request] = provider.decide.mock.calls[0] as unknown as [
      { questions: { group: { criteria: Record<string, string> } } },
    ];
    expect(Object.keys(request.questions.group.criteria)).toEqual(["g-sales", "g-ops", "none"]);
  });

  it("leaves the choice to the router bot when unsure, when none fits, or on an unknown id", async () => {
    expect(await ask(providerAnswering("g-sales", 0.1))).toBeUndefined();
    expect(await ask(providerAnswering("g-sales"))).toBeUndefined();
    expect(await ask(providerAnswering("none", 0.99))).toBeUndefined();
    expect(await ask(providerAnswering("g-other", 0.99))).toBeUndefined();
  });

  it("does not ask when there is nothing to choose between", async () => {
    const provider = providerAnswering("g-sales", 0.9);
    expect(await ask(provider, { groups: [groups[0]] })).toBeUndefined();
    expect(await ask(provider, { request: "  " })).toBeUndefined();
    expect(provider.decide).not.toHaveBeenCalled();
  });

  it("falls back to the router bot when the model fails", async () => {
    const provider: DecisionProvider = {
      decide: async () => {
        throw new DecisionProviderError("unavailable");
      },
    };
    expect(await ask(provider)).toBeUndefined();
  });
});

describe("renderRoutingHint", () => {
  it("names the group and its id", () => {
    expect(renderRoutingHint(groups[0] as (typeof groups)[0])).toContain(
      '"Sales" (group_id: g-sales)',
    );
  });
});
