import type { TicketField } from "@corvo/contracts";

/** What to send for the rows a person edited: changed or new values, and "" for a removed field. */
export function fieldChanges(
  current: readonly TicketField[],
  rows: readonly TicketField[],
): Record<string, string> {
  const changes: Record<string, string> = {};
  const kept = new Set<string>();
  for (const row of rows) {
    const name = row.name.trim();
    if (!name || row.value === "") continue;
    kept.add(name.toLowerCase());
    const before = current.find((field) => field.name.toLowerCase() === name.toLowerCase());
    if (before?.value !== row.value) changes[before?.name ?? name] = row.value;
  }
  for (const field of current) {
    if (!kept.has(field.name.toLowerCase())) changes[field.name] = "";
  }
  return changes;
}
