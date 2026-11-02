import { describe, expect, it } from "vitest";
import {
  normalizeUiLocale,
  persistUiLocale,
  resolveUiLocale,
  UI_LOCALE_STORAGE_KEY,
  UI_LOCALES,
} from "./ui-locale";

describe("normalizeUiLocale", () => {
  it("maps regional tags onto supported locales", () => {
    expect(normalizeUiLocale("en-US")).toBe("en");
    expect(normalizeUiLocale("en-GB")).toBe("en");
    expect(normalizeUiLocale("pt-BR")).toBe("pt-BR");
    expect(normalizeUiLocale("pt")).toBe("pt-BR");
    expect(normalizeUiLocale("pt-PT")).toBe("pt-BR");
    expect(normalizeUiLocale("pt_br")).toBe("pt-BR");
    expect(normalizeUiLocale("es")).toBe("es");
    expect(normalizeUiLocale("es-ES")).toBe("es");
    expect(normalizeUiLocale("es-MX")).toBe("es");
    expect(normalizeUiLocale("es-419")).toBe("es");
    expect(normalizeUiLocale("ES")).toBe("es");
    expect(normalizeUiLocale("es_AR")).toBe("es");
    expect(normalizeUiLocale(" es ")).toBe("es");
  });

  it("falls back to English for languages the app no longer ships", () => {
    for (const tag of ["ko-KR", "he", "iw", "ru-RU", "tr", "hi", "nl-NL"]) {
      expect(normalizeUiLocale(tag), tag).toBe("en");
    }
    expect(normalizeUiLocale("sv-SE")).toBe("en");
    expect(normalizeUiLocale("")).toBe("en");
    expect(normalizeUiLocale(null)).toBe("en");
  });

  it("ships English, German, Brazilian Portuguese, Chinese, Spanish, French and Japanese", () => {
    expect([...UI_LOCALES]).toEqual(["en", "de", "pt-BR", "zh-CN", "es", "fr", "ja"]);
    expect(normalizeUiLocale("de-DE")).toBe("de");
    expect(normalizeUiLocale("fr-CA")).toBe("fr");
    expect(normalizeUiLocale("ja_JP")).toBe("ja");
    expect(normalizeUiLocale("zh-Hans-CN")).toBe("zh-CN");
    // Traditional Chinese is not shipped, so it reads as Simplified.
    expect(normalizeUiLocale("zh-TW")).toBe("zh-CN");
  });
});

describe("resolveUiLocale", () => {
  it("prefers the saved choice over env and navigator", () => {
    expect(
      resolveUiLocale({
        stored: "es",
        envDefault: "pt-BR",
        navigatorLanguage: "en-US",
      }),
    ).toBe("es");
  });

  it("uses VITE_DEFAULT_UI_LOCALE when nothing is saved", () => {
    expect(
      resolveUiLocale({
        stored: null,
        envDefault: "pt-BR",
        navigatorLanguage: "es-MX",
      }),
    ).toBe("pt-BR");
  });

  it("uses navigator.language next, then English", () => {
    expect(resolveUiLocale({ stored: null, envDefault: null, navigatorLanguage: "pt-BR" })).toBe(
      "pt-BR",
    );
    expect(resolveUiLocale({ stored: null, envDefault: null, navigatorLanguage: "es-MX" })).toBe(
      "es",
    );
    expect(resolveUiLocale({ stored: null, envDefault: null, navigatorLanguage: "de-DE" })).toBe(
      "de",
    );
    expect(resolveUiLocale({ stored: null, envDefault: null, navigatorLanguage: "sv-SE" })).toBe(
      "en",
    );
    expect(resolveUiLocale({ stored: null, envDefault: null, navigatorLanguage: null })).toBe("en");
  });

  it("falls back to English when a saved choice is a language the app no longer ships", () => {
    expect(resolveUiLocale({ stored: "ru", envDefault: null, navigatorLanguage: "pt-BR" })).toBe(
      "en",
    );
  });

  it("reads localStorage via the storage helper", () => {
    const storage = {
      getItem: (key: string) => (key === UI_LOCALE_STORAGE_KEY ? "es" : null),
    };
    expect(resolveUiLocale({ storage, envDefault: null, navigatorLanguage: null })).toBe("es");
  });
});

describe("persistUiLocale", () => {
  it("writes the storage key", () => {
    const store = new Map<string, string>();
    persistUiLocale("pt-BR", {
      setItem: (key, value) => {
        store.set(key, value);
      },
    });
    expect(store.get(UI_LOCALE_STORAGE_KEY)).toBe("pt-BR");
  });
});
