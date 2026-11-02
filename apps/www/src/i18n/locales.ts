/** The languages the app speaks, so a visitor who likes the page finds the same one inside. */
export const LOCALES = ["en", "pt", "es", "fr", "de", "ja", "zh"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  pt: "Português",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
  zh: "简体中文",
};

export const LOCALE_OG: Record<Locale, string> = {
  en: "en_US",
  pt: "pt_BR",
  es: "es_ES",
  fr: "fr_FR",
  de: "de_DE",
  ja: "ja_JP",
  zh: "zh_CN",
};

export const LOCALE_HTML_LANG: Record<Locale, string> = {
  en: "en",
  pt: "pt-BR",
  es: "es",
  fr: "fr",
  de: "de",
  ja: "ja",
  zh: "zh-CN",
};

/** BCP 47 tags shared by page hreflang links and the sitemap. */
export const LOCALE_HREFLANG: Record<Locale, string> = {
  en: "en-US",
  pt: "pt-BR",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  ja: "ja-JP",
  zh: "zh-CN",
};

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value);
}

export function localeHomePath(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "/" : `/${locale}/`;
}

export function localeHashPath(locale: Locale, hash: string): string {
  const base = localeHomePath(locale);
  const id = hash.replace(/^#/, "");
  return base === "/" ? `/#${id}` : `${base}#${id}`;
}
