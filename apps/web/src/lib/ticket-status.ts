import type { BoardStatusLabels, TicketStatus } from "@corvo/contracts";
import { useLingui } from "@lingui/react/macro";
import { useMemo } from "react";

/** A board's own column name where it set one, the built-in name everywhere else. */
export function resolveStatusLabels(
  builtin: Record<TicketStatus, string>,
  overrides: BoardStatusLabels | undefined,
): Record<TicketStatus, string> {
  const labels = { ...builtin };
  for (const status of Object.keys(builtin) as TicketStatus[]) {
    const label = overrides?.[status]?.trim();
    if (label) labels[status] = label;
  }
  return labels;
}

export function useBuiltinStatusLabels(): Record<TicketStatus, string> {
  const { t } = useLingui();
  return useMemo(
    () => ({
      todo: t`To do`,
      doing: t`In progress`,
      review: t`In review`,
      blocked: t`Blocked`,
      done: t`Done`,
      closed: t`Won't do`,
    }),
    [t],
  );
}

export function useTicketStatusLabels(overrides?: BoardStatusLabels): Record<TicketStatus, string> {
  const builtin = useBuiltinStatusLabels();
  return useMemo(() => resolveStatusLabels(builtin, overrides), [builtin, overrides]);
}
