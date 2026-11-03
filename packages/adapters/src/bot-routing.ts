import type { AdapterContext, DecisionProvider } from "@corvo/adapter-kit";
import { autoReviewMinConfidence, autoReviewTimeoutMs, truncateReviewText } from "./auto-review.js";

export const ROUTING_DECISION_RUBRIC_VERSION = "routing-v1";
const MAX_REQUEST_CHARS = 1_200;
const MAX_GROUP_CHARS = 240;
const NONE = "none";

export type RoutingGroup = { id: string; name: string; purpose?: string | null };

/**
 * The group a decision model picks for a request, or undefined when it is unsure, names
 * nothing, or fails. The router bot stays in charge: this only informs its choice.
 */
export async function chooseRoutingGroup(
  input: {
    provider: DecisionProvider;
    model: string;
    request: string;
    groups: readonly RoutingGroup[];
    minConfidence?: number;
    timeoutMs?: number;
  },
  context: AdapterContext & { signal: AbortSignal },
): Promise<RoutingGroup | undefined> {
  if (input.groups.length < 2 || !input.request.trim()) return undefined;
  try {
    const result = await input.provider.decide(
      {
        model: input.model,
        state: {
          rubricVersion: ROUTING_DECISION_RUBRIC_VERSION,
          request: truncateReviewText(input.request, MAX_REQUEST_CHARS),
        },
        questions: {
          group: {
            type: "choice",
            instructions: "Which group should handle this request?",
            criteria: {
              ...Object.fromEntries(
                input.groups.map((group) => [
                  group.id,
                  truncateReviewText(
                    `${group.name}${group.purpose ? `: ${group.purpose}` : ""}`,
                    MAX_GROUP_CHARS,
                  ),
                ]),
              ),
              [NONE]: "No group clearly fits, or two fit about equally",
            },
          },
        },
      },
      {
        ...context,
        signal: AbortSignal.any([
          context.signal,
          AbortSignal.timeout(input.timeoutMs ?? autoReviewTimeoutMs()),
        ]),
      },
    );
    const answer = result.answers.group;
    if (!answer || answer.choice === NONE) return undefined;
    if (
      typeof answer.confidence !== "number" ||
      answer.confidence < (input.minConfidence ?? autoReviewMinConfidence())
    )
      return undefined;
    return input.groups.find((group) => group.id === answer.choice);
  } catch {
    return undefined;
  }
}

/** The line that tells the router bot what the routing model recommends. */
export function renderRoutingHint(group: RoutingGroup): string {
  return `The routing model recommends the group ${JSON.stringify(group.name)} (group_id: ${group.id}) for the user's request. Hand off there unless the request clearly points elsewhere.`;
}
