import { t } from "@lingui/core/macro";
import type { Routine } from "@corvo/contracts";
import type { CronLabels } from "@corvo/core";
import { ENGLISH_CRON_LABELS, formatCron } from "@corvo/core";

/** When a routine starts, in a few words: its schedule and every other way to wake it. */
export function routineTriggerSummary(
  routine: Routine,
  labels: CronLabels = ENGLISH_CRON_LABELS,
): string {
  if (!routine.active) return t`Paused`;
  const parts: string[] = [];
  if (routine.webhookEnabled) parts.push(t`When a webhook fires`);
  if (routine.githubEnabled) parts.push(t`Git event`);
  if (routine.messageProvider === "slack") parts.push(t`Slack message`);
  else if (routine.messageProvider === "teams") parts.push(t`Teams message`);
  else if (routine.messageProvider) parts.push(t`Message event`);
  for (const cron of routine.crons) parts.push(formatCron(cron, labels));
  if (routine.watch) parts.push(t`When something changes`);
  return parts.length > 0 ? parts.join(", ") : t`No trigger`;
}
