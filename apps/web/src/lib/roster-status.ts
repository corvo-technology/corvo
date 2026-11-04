import { WORKING_RUN_STATUSES } from "@corvo/core";
import { t } from "@lingui/core/macro";

export function rosterHasUndismissedRunError(
  runErrorId: string | null | undefined,
  dismissedRunErrorIds: ReadonlySet<string>,
): boolean {
  return Boolean(runErrorId && !dismissedRunErrorIds.has(runErrorId));
}

/** Short sidebar label while a bot is queued, starting, or running. Null keeps the message preview. */
export function rosterWorkStatusLabel(status: string): string | null {
  switch (status) {
    case "queued":
      return t`Waiting in line…`;
    case "leased":
      return t`Starting…`;
    case "running":
      return t`Working…`;
    default:
      return null;
  }
}

/** The states where a bot waits for the person or has failed; every row shows them, not only compact ones. */
export function rosterAttentionLabel(status: string): string | null {
  switch (status) {
    case "waiting_input":
      return t`Needs an answer`;
    case "waiting_takeover":
      return t`Needs you`;
    case "failed":
      return t`Error`;
    default:
      return null;
  }
}

/** Compact rows keep actionable status visible in place of the message preview. */
export function compactRosterStatusLabel(status: string): string | null {
  return rosterWorkStatusLabel(status) ?? rosterAttentionLabel(status);
}

const WORKING_STATUSES: ReadonlySet<string> = new Set(WORKING_RUN_STATUSES);

/** The members of a channel that are queued, starting or running, in the channel's own order. */
export function workingMembers<T extends { status?: string }>(members: readonly T[]): T[] {
  return members.filter(
    (member) => member.status !== undefined && WORKING_STATUSES.has(member.status),
  );
}
