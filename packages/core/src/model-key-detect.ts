/** Key prefixes by provider, most specific first: a longer prefix must win over `sk-`. */
const KEY_PREFIXES: ReadonlyArray<readonly [prefix: string, provider: string]> = [
  ["sk-or-", "openrouter"],
  ["sk-ant-", "anthropic"],
  ["gsk_", "groq"],
  ["xai-", "xai"],
  ["AIza", "google"],
  ["sk-", "openai"],
];

/** The provider a pasted API key belongs to, by its prefix, or null when it is not recognised. */
export function detectProviderFromKey(rawKey: string): string | null {
  const key = rawKey.trim();
  for (const [prefix, provider] of KEY_PREFIXES) {
    if (key.startsWith(prefix) && key.length > prefix.length) return provider;
  }
  return null;
}
