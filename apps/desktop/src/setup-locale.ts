import path from "node:path";
import { readPrivateFile, writePrivateFile } from "./setup-store.js";

/** The languages the app's screens are translated into; the same set the web app offers. */
export const SETUP_LOCALES = ["en", "de", "pt-BR", "zh-CN", "es", "fr", "ja"] as const;

export type SetupLocale = (typeof SETUP_LOCALES)[number];

const LOCALE_FILE = "locale.json";

/** Maps a system language tag (`pt-PT`, `es-MX`) to a supported locale, or null. */
export function matchSetupLocale(raw: string | null | undefined): SetupLocale | null {
  const tag = raw?.trim().replace(/_/g, "-").toLowerCase() ?? "";
  if (!tag) return null;
  const exact = SETUP_LOCALES.find((locale) => locale.toLowerCase() === tag);
  if (exact) return exact;
  const [language = ""] = tag.split("-");
  if (language === "zh") return "zh-CN";
  if (language === "pt") return "pt-BR";
  return SETUP_LOCALES.find((locale) => locale.toLowerCase() === language) ?? null;
}

export async function readSavedLocale(userDataDir: string): Promise<SetupLocale | null> {
  const raw = await readPrivateFile(path.join(userDataDir, LOCALE_FILE), 256);
  if (raw === null) return null;
  try {
    const value = (JSON.parse(raw) as { locale?: unknown }).locale;
    return typeof value === "string" && (SETUP_LOCALES as readonly string[]).includes(value)
      ? (value as SetupLocale)
      : null;
  } catch {
    return null;
  }
}

export async function writeSavedLocale(userDataDir: string, locale: SetupLocale): Promise<void> {
  await writePrivateFile(path.join(userDataDir, LOCALE_FILE), `${JSON.stringify({ locale })}\n`);
}
