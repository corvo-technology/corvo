import type { AgentRuntimeEvent, DecisionProvider } from "@corvo/adapter-kit";
import { recordUsage } from "@corvo/db";
import { decisionModel } from "./decision-models.js";
import type { ExecutorDeps } from "./executor-deps.js";
import { HttpDecisionProvider } from "./http-decisions.js";
import { ModelDecisionProvider } from "./model-decisions.js";
import { effectiveModelRole } from "./model-roles.js";
import { findConnectedModelCredential } from "./model-selection.js";
import { resolveConnectedRunModel, resolveFastRunModel, resolveModelKey } from "./run-model.js";

export type DecisionScope = {
  runId: string;
  spaceId: string;
  userId: string;
  botId: string;
  threadId: string;
};

type Chooser = { provider: DecisionProvider; model: string };

/** Records what a side question cost against the run it helps, under its own operation. */
function usageRecorder(deps: ExecutorDeps, scope: DecisionScope, operation: string) {
  return (event: Extract<AgentRuntimeEvent, { type: "usage" }>) =>
    recordUsage(deps.prisma, event, {
      spaceId: scope.spaceId,
      userId: scope.userId,
      botId: scope.botId,
      parentRunId: scope.runId,
      runId: scope.runId,
      operationId: `${operation}:${scope.runId}`,
      operationKind: "setup",
    });
}

/** The member's routing model when they chose a decision model and its connection works. */
export async function routingDecisionChooser(
  deps: ExecutorDeps,
  scope: DecisionScope,
  operation: string,
  registerSecrets?: (values: string[]) => void,
): Promise<Chooser | undefined> {
  const { userId, spaceId } = scope;
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
      registerSecrets,
    );
    return {
      provider: new HttpDecisionProvider("openrouter", {
        apiKey: key.apiKey ?? "",
        callObserver: key.callObserver,
        onUsage: usageRecorder(deps, scope, operation),
      }),
      model: primary.modelId,
    };
  } catch {
    return undefined;
  }
}

/**
 * The routing model when there is one, then the member's fast model, otherwise the model the run
 * itself uses, so a member without a decision model still gets the answer, at the price of a
 * normal call.
 */
export async function decisionChooserOrRunModel(
  deps: ExecutorDeps,
  scope: DecisionScope,
  operation: string,
  own: { provider: string; modelId: string; credentialId?: string },
  registerSecrets?: (values: string[]) => void,
): Promise<Chooser | undefined> {
  const routing = await routingDecisionChooser(deps, scope, operation, registerSecrets);
  if (routing) return routing;
  const fast = await resolveFastRunModel(deps, { userId: scope.userId, spaceId: scope.spaceId });
  if (fast) {
    return {
      provider: new ModelDecisionProvider({
        runtime: deps.runtime,
        model: fast,
        scope,
        onUsage: usageRecorder(deps, scope, operation),
      }),
      model: fast.id,
    };
  }
  try {
    const model = await resolveConnectedRunModel(
      deps,
      { userId: scope.userId, spaceId: scope.spaceId },
      own.provider,
      own.modelId,
      registerSecrets,
      false,
      null,
      own.credentialId,
    );
    return {
      provider: new ModelDecisionProvider({
        runtime: deps.runtime,
        model,
        scope,
        onUsage: usageRecorder(deps, scope, operation),
      }),
      model: own.modelId,
    };
  } catch {
    return undefined;
  }
}
