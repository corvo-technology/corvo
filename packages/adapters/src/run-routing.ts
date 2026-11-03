import type { AdapterContext } from "@corvo/adapter-kit";
import { recordUsage } from "@corvo/db";
import type { RoutingGroup } from "./bot-routing.js";
import { chooseRoutingGroup, renderRoutingHint } from "./bot-routing.js";
import { decisionModel } from "./decision-models.js";
import type { ExecutorDeps } from "./executor-deps.js";
import { HttpDecisionProvider } from "./http-decisions.js";
import { effectiveModelRole } from "./model-roles.js";
import { findConnectedModelCredential } from "./model-selection.js";
import { resolveModelKey } from "./run-model.js";

/**
 * What the member's routing model recommends for a router bot's run, as a line for its
 * context. Nothing when they chose no routing model or it cannot answer: the bot decides.
 */
export async function routingHintForRun(
  deps: ExecutorDeps,
  scope: { runId: string; spaceId: string; userId: string; botId: string },
  input: {
    request: string;
    groups: readonly RoutingGroup[];
    context: AdapterContext & { signal: AbortSignal };
    registerSecrets?: (values: string[]) => void;
  },
): Promise<string | undefined> {
  const { runId, spaceId, userId, botId } = scope;
  if (input.groups.length < 2 || !input.request.trim()) return undefined;
  try {
    const { primary } = await effectiveModelRole(deps.prisma, { userId, spaceId }, "routing", {});
    if (!primary || !decisionModel(primary.provider, primary.modelId)) return undefined;
    const credential = await findConnectedModelCredential(
      deps.prisma,
      deps.secretStore,
      { userId, spaceId },
      primary.provider,
      primary.modelId,
      { credentialId: primary.credentialId },
    );
    const key = await resolveModelKey(
      deps,
      userId,
      spaceId,
      credential,
      primary.provider,
      primary.modelId,
      input.registerSecrets,
    );
    const group = await chooseRoutingGroup(
      {
        provider: new HttpDecisionProvider("openrouter", {
          apiKey: key.apiKey ?? "",
          callObserver: key.callObserver,
          onUsage: (event) =>
            recordUsage(deps.prisma, event, {
              spaceId,
              userId,
              botId,
              parentRunId: runId,
              runId,
              operationId: `routing:${runId}`,
              operationKind: "setup",
            }),
        }),
        model: primary.modelId,
        request: input.request,
        groups: input.groups,
      },
      input.context,
    );
    return group ? renderRoutingHint(group) : undefined;
  } catch {
    return undefined;
  }
}
