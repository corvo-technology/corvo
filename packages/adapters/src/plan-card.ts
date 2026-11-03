import type { MessageBlock } from "@corvo/contracts";
import { appendEventInTransaction } from "@corvo/db";
import { getLogger } from "@corvo/logging";
import type { ExecutorDeps } from "./executor-deps.js";
import { publishMessage } from "./run-messages.js";

type PlanBlock = Extract<MessageBlock, { kind: "plan" }>;
type PlanStep = PlanBlock["steps"][number];
type PlanRun = {
  id: string;
  spaceId: string;
  threadId: string;
  botId: string;
  trigger: string;
};

const MAX_STEPS = 12;
const STATUSES = new Set<PlanStep["status"]>(["pending", "running", "done", "failed"]);
const PLAN_LOOKBACK = 30;

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** plan_set: write the plan of a request with several stages as a card in this chat. */
export async function setPlanCard(
  deps: ExecutorDeps,
  run: PlanRun,
  input: { title?: unknown; steps?: unknown },
) {
  const title = text(input.title, 120);
  const raw = Array.isArray(input.steps) ? input.steps : [];
  const steps: PlanStep[] = raw
    .map((step) => step as { label?: unknown; owner?: unknown })
    .filter((step) => text(step?.label, 200))
    .slice(0, MAX_STEPS)
    .map((step, index) => ({
      id: String(index + 1),
      label: text(step.label, 200),
      ...(text(step.owner, 80) ? { owner: text(step.owner, 80) } : {}),
      status: "pending" as const,
    }));
  if (!title || steps.length === 0) {
    return { error: `Give a title and 1 to ${MAX_STEPS} steps, each with a label.` };
  }
  await publishMessage(deps, run, "bot", [{ kind: "plan", title, steps }]);
  return {
    ok: true as const,
    steps: steps.map((step) => ({ id: step.id, label: step.label })),
    note: "The plan is shown to the user. Keep it current with plan_update as each step starts and finishes.",
  };
}

/** plan_update: change steps of the latest plan in this chat, in place. */
export async function updatePlanCard(
  deps: ExecutorDeps,
  run: PlanRun,
  input: { updates?: unknown; add?: unknown },
) {
  const updates = Array.isArray(input.updates) ? input.updates : [];
  const added = Array.isArray(input.add) ? input.add : [];
  if (updates.length === 0 && added.length === 0) {
    return { error: "Send updates (step, status, note) or add (label, owner)." };
  }
  const recent = await deps.prisma.message.findMany({
    where: { threadId: run.threadId, role: "bot" },
    orderBy: { seq: "desc" },
    take: PLAN_LOOKBACK,
    select: { id: true, blocks: true },
  });
  const found = recent
    .map((message) => ({ id: message.id, blocks: message.blocks as MessageBlock[] }))
    .find((message) => message.blocks.some((block) => block.kind === "plan"));
  if (!found) return { error: "There is no plan in this chat. Write one with plan_set first." };

  const next = found.blocks.map((block) => ({ ...block }));
  const index = next.findIndex((block) => block.kind === "plan");
  const plan = next[index] as PlanBlock;
  const steps = plan.steps.map((step) => ({ ...step }));
  for (const update of updates as Array<Record<string, unknown>>) {
    const step = steps.find((item) => item.id === String(update?.step ?? ""));
    if (!step) {
      return {
        error: `No step "${String(update?.step ?? "")}". The steps are ${steps.map((item) => item.id).join(", ")}.`,
      };
    }
    if (update.status !== undefined) {
      if (!STATUSES.has(update.status as PlanStep["status"])) {
        return { error: "status must be pending, running, done or failed." };
      }
      step.status = update.status as PlanStep["status"];
    }
    if (update.note !== undefined) {
      const note = text(update.note, 300);
      if (note) step.note = note;
      else delete step.note;
    }
    if (update.owner !== undefined && text(update.owner, 80)) step.owner = text(update.owner, 80);
    if (update.label !== undefined && text(update.label, 200)) step.label = text(update.label, 200);
  }
  for (const item of added as Array<Record<string, unknown>>) {
    if (steps.length >= MAX_STEPS) break;
    const label = text(item?.label, 200);
    if (!label) continue;
    const owner = text(item?.owner, 80);
    const id = String(Math.max(0, ...steps.map((step) => Number(step.id) || 0)) + 1);
    steps.push({ id, label, ...(owner ? { owner } : {}), status: "pending" });
  }
  next[index] = { ...plan, steps };

  const committed = await deps.prisma.$transaction(async (tx) => {
    await tx.message.update({ where: { id: found.id }, data: { blocks: next } });
    return appendEventInTransaction(tx, {
      spaceId: run.spaceId,
      threadId: run.threadId,
      botId: run.botId,
      type: "thread.message.updated",
      payload: { messageId: found.id, role: "bot", blocks: next },
    });
  });
  await deps.events.notify(run.threadId, committed.seq).catch((error) => {
    getLogger().error("plan update realtime notification", error);
  });
  return {
    ok: true as const,
    steps: steps.map((step) => ({ id: step.id, label: step.label, status: step.status })),
  };
}
