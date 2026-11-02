/**
 * Match a BCP-47 tag (`pt-PT`, `es-419`, `en_GB`) to one of the `supported` UI locales, else
 * English. Each surface ships its own catalogs, so it passes its own list.
 */
export function matchUiLocale<L extends string>(
  raw: string | null | undefined,
  supported: readonly L[],
): L | "en" {
  const candidate = uiLocaleCandidate(raw);
  return (supported as readonly string[]).includes(candidate) ? (candidate as L) : "en";
}

function uiLocaleCandidate(raw: string | null | undefined): string {
  if (!raw) return "en";
  const normalized = raw.trim().toLowerCase().replace(/_/g, "-");
  if (normalized === "pt" || normalized.startsWith("pt-")) return "pt-BR";
  // Traditional Chinese is not shipped, so every Chinese tag reads as Simplified.
  if (normalized === "zh" || normalized.startsWith("zh-")) return "zh-CN";
  return normalized.split("-")[0] ?? "";
}
