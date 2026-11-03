import type { AdapterContext } from "@corvo/adapter-kit";
import type { RoutingGroup } from "./bot-routing.js";
import { chooseRoutingGroup, renderRoutingHint } from "./bot-routing.js";
import type { ExecutorDeps } from "./executor-deps.js";
import { routingDecisionChooser } from "./run-decisions.js";

/**
 * What the member's routing model recommends for a router bot's run, as a line for its
 * context. Nothing when they chose no routing model or it cannot answer: the bot decides.
 */
export async function routingHintForRun(
  deps: ExecutorDeps,
  scope: { runId: string; spaceId: string; userId: string; botId: string; threadId: string },
  input: {
    request: string;
    groups: readonly RoutingGroup[];
    context: AdapterContext & { signal: AbortSignal };
    registerSecrets?: (values: string[]) => void;
  },
): Promise<string | undefined> {
  if (input.groups.length < 2 || !input.request.trim()) return undefined;
  const chooser = await routingDecisionChooser(deps, scope, "routing", input.registerSecrets);
  if (!chooser) return undefined;
  const group = await chooseRoutingGroup(
    { ...chooser, request: input.request, groups: input.groups },
    input.context,
  );
  return group ? renderRoutingHint(group) : undefined;
}
