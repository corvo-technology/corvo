import type { EvalJudge } from "./judge.js";

/** Bump when the rubric or the reviewed examples change, so earlier reports stay comparable. */
export const SQUAD_ROUTING_RUBRIC_VERSION = "squad-routing-v1";

const RUBRIC = `Rubric ${SQUAD_ROUTING_RUBRIC_VERSION}. The evidence holds a person's request, the squads the router could choose (each with a one-line purpose), and the reason the router gave for its choice. Pass only if the reason is a sound, specific justification for sending this request to the chosen squad given that squad's purpose: it names what in the request matches what the squad does. Fail if the reason is generic, unrelated to the request, contradicts the squad's purpose, or merely repeats the squad's name. Equivalent wording and other languages are fine. Do not reward length.`;

export type SquadRoutingCase = {
  id: string;
  squads: { id: string; name: string; purpose: string }[];
  request: string;
  /** What the router should do, by observable effect rather than by wording. */
  expected: { kind: "route"; groupId: string } | { kind: "ask" } | { kind: "none" };
};

/** What a run did: sent work to a squad, asked the person, or did neither. */
export type SquadRoutingOutcome =
  | { kind: "handoff"; groupId: string; reason?: string }
  | { kind: "ask"; question: string }
  | { kind: "none" };

export type SquadRoutingGrade = {
  status: "pass" | "fail" | "unqualified";
  reason: string;
};

const PRODUCT = {
  id: "g-product",
  name: "Produto & Marketing",
  purpose: "Analisa concorrentes, avalia design e escreve textos de landing pages",
};
const FINANCE = {
  id: "g-finance",
  name: "Financeiro",
  purpose: "Emite notas fiscais e acompanha cobranças",
};
const SUPPORT = {
  id: "g-support",
  name: "Suporte",
  purpose: "Responde dúvidas de clientes e triagem de tickets",
};
const CARE = {
  id: "g-care",
  name: "Atendimento",
  purpose: "Responde dúvidas de clientes e acompanha pedidos",
};

export const SQUAD_ROUTING_CASES: SquadRoutingCase[] = [
  {
    id: "clear-landing-review",
    squads: [PRODUCT, FINANCE, SUPPORT],
    request: "Analisem a landing page de um concorrente e vejam o que podemos melhorar na nossa.",
    expected: { kind: "route", groupId: PRODUCT.id },
  },
  {
    id: "clear-invoice",
    squads: [PRODUCT, FINANCE, SUPPORT],
    request: "Emitam a nota fiscal do pedido 4821 para o cliente.",
    expected: { kind: "route", groupId: FINANCE.id },
  },
  {
    id: "ambiguous-customer-questions",
    squads: [PRODUCT, SUPPORT, CARE],
    request: "Um cliente perguntou onde está o pedido dele, cuidem disso.",
    expected: { kind: "ask" },
  },
  {
    id: "no-fit-travel",
    squads: [PRODUCT, FINANCE, SUPPORT],
    request: "Reservem um voo para São Paulo na sexta.",
    expected: { kind: "none" },
  },
];

/** The facts a judge needs, and nothing else from the run. */
export function squadRoutingEvidence(testCase: SquadRoutingCase, outcome: SquadRoutingOutcome) {
  return {
    request: testCase.request,
    squads: testCase.squads,
    chosen:
      outcome.kind === "handoff"
        ? testCase.squads.find((squad) => squad.id === outcome.groupId)
        : undefined,
    reason: outcome.kind === "handoff" ? outcome.reason : undefined,
  };
}

function observableEffect(
  testCase: SquadRoutingCase,
  outcome: SquadRoutingOutcome,
): SquadRoutingGrade | null {
  const { expected } = testCase;
  if (expected.kind === "route") {
    if (outcome.kind !== "handoff" || outcome.groupId !== expected.groupId) {
      return { status: "fail", reason: `expected a handoff to ${expected.groupId}` };
    }
    if (!outcome.reason?.trim()) return { status: "fail", reason: "the handoff gave no reason" };
    return null;
  }
  if (expected.kind === "ask") {
    return outcome.kind === "ask"
      ? null
      : { status: "fail", reason: "expected a question to the person, not a guess" };
  }
  return outcome.kind === "none"
    ? null
    : { status: "fail", reason: "no squad fits, so nothing should be handed off" };
}

/**
 * Grades the observable effect deterministically. Only a correct handoff has a reason to judge;
 * that judgment is opt-in, and a judge that errors leaves the case unqualified, never passed.
 */
export async function gradeSquadRouting(
  testCase: SquadRoutingCase,
  outcome: SquadRoutingOutcome,
  judged?: { judge: EvalJudge; signal: AbortSignal },
): Promise<SquadRoutingGrade> {
  const failed = observableEffect(testCase, outcome);
  if (failed) return failed;
  if (!judged || outcome.kind !== "handoff") return { status: "pass", reason: "observable effect" };
  try {
    const judgment = await judged.judge(
      { rubric: RUBRIC, evidence: squadRoutingEvidence(testCase, outcome) },
      judged.signal,
    );
    return { status: judgment.pass ? "pass" : "fail", reason: judgment.reason };
  } catch (error) {
    return {
      status: "unqualified",
      reason: `the judge could not decide: ${error instanceof Error ? error.message : "error"}`,
    };
  }
}
