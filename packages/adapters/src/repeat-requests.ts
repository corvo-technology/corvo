import type { AdapterContext, DecisionProvider } from "@corvo/adapter-kit";
import { autoReviewMinConfidence, autoReviewTimeoutMs, truncateReviewText } from "./auto-review.js";

export const REPEAT_DECISION_RUBRIC_VERSION = "repeat-v1";
/** Earlier requests compared per run; the call stays one short question list. */
export const MAX_EARLIER_REQUESTS = 12;
/** Earlier requests of the same kind that make a new one worth turning into a routine. */
export const REPEATS_BEFORE_OFFER = 2;
const MAX_REQUEST_CHARS = 600;

/**
 * How many of the earlier requests a decision model judges to be the same kind of
 * recurring task as the new one. Zero when it is unsure or fails: the bot offers nothing.
 */
export async function countRepeatedRequests(
  input: {
    provider: DecisionProvider;
    model: string;
    request: string;
    earlier: readonly string[];
    minConfidence?: number;
    timeoutMs?: number;
  },
  context: AdapterContext & { signal: AbortSignal },
): Promise<number> {
  const earlier = input.earlier.slice(0, MAX_EARLIER_REQUESTS);
  if (!input.request.trim() || earlier.length < REPEATS_BEFORE_OFFER) return 0;
  try {
    const result = await input.provider.decide(
      {
        model: input.model,
        state: {
          rubricVersion: REPEAT_DECISION_RUBRIC_VERSION,
          request: truncateReviewText(input.request, MAX_REQUEST_CHARS),
          earlier: earlier.map((text) => truncateReviewText(text, MAX_REQUEST_CHARS)),
        },
        questions: Object.fromEntries(
          earlier.map((_, index) => [
            `r${index}`,
            {
              type: "choice" as const,
              instructions: `Is the new request the same kind of task as earlier[${index}]?`,
              criteria: {
                same: "Asks for the same output or action again, so one routine could cover both",
                different: "A different task, or only about the same topic",
              },
            },
          ]),
        ),
      },
      {
        ...context,
        signal: AbortSignal.any([
          context.signal,
          AbortSignal.timeout(input.timeoutMs ?? autoReviewTimeoutMs()),
        ]),
      },
    );
    const floor = input.minConfidence ?? autoReviewMinConfidence();
    return Object.values(result.answers).filter(
      (answer) =>
        answer.choice === "same" &&
        typeof answer.confidence === "number" &&
        answer.confidence >= floor,
    ).length;
  } catch {
    return 0;
  }
}

/** The line that tells the bot this is a repeated request worth offering a routine for. */
export function renderRepeatHint(repeats: number): string {
  return `The user has made this kind of request ${repeats} times before. If it is useful on a rhythm, offer to make it a routine with ask_user, naming what you would send and when. Offer once: if the thread shows they declined or already have one, do not ask again.`;
}
