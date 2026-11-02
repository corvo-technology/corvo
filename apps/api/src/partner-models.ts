/**
 * True when a partner's customer, whose partner fixes the model, asks for a model other than the
 * one the agent already has. A save that leaves the model as it is passes, because the app sends
 * the whole form.
 */
export function partnerModelChangeRefused(
  policy: "fixed" | "choose" | null,
  existing: { modelProvider: string | null; modelId: string | null },
  input: { modelProvider?: string | null; modelId?: string | null },
): boolean {
  if (policy !== "fixed" || input.modelProvider === undefined) return false;
  return (
    input.modelProvider !== existing.modelProvider || (input.modelId ?? null) !== existing.modelId
  );
}
