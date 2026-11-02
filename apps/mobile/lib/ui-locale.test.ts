import { describe, expect, it } from "vitest";
import { normalizeUiLocale, resolveUiLocale, UI_LOCALES } from "./ui-locale";

describe("normalizeUiLocale", () => {
  it("maps regional tags onto supported locales", () => {
    expect(normalizeUiLocale("en-US")).toBe("en");
    expect(normalizeUiLocale("pt")).toBe("pt-BR");
    expect(normalizeUiLocale("pt-BR")).toBe("pt-BR");
    expect(normalizeUiLocale("pt-PT")).toBe("pt-BR");
    expect(normalizeUiLocale("pt_br")).toBe("pt-BR");
    expect(normalizeUiLocale("es")).toBe("es");
    expect(normalizeUiLocale("es-MX")).toBe("es");
    expect(normalizeUiLocale("es-419")).toBe("es");
    expect(normalizeUiLocale("es_AR")).toBe("es");
  });

  it("falls back to English for languages the app no longer ships", () => {
    for (const tag of ["fr-FR", "ko-KR", "nl", "ru-RU", "tr", "sv-SE"]) {
      expect(normalizeUiLocale(tag), tag).toBe("en");
    }
    expect(normalizeUiLocale("")).toBe("en");
    expect(normalizeUiLocale(null)).toBe("en");
  });

  it("ships English, Chinese, German, Brazilian Portuguese, Spanish and Japanese", () => {
    expect([...UI_LOCALES]).toEqual(["en", "zh-CN", "de", "pt-BR", "es", "ja"]);
    expect(normalizeUiLocale("de-AT")).toBe("de");
    expect(normalizeUiLocale("ja_JP")).toBe("ja");
    expect(normalizeUiLocale("zh-Hans-CN")).toBe("zh-CN");
    // Traditional Chinese is not shipped, so it reads as Simplified.
    expect(normalizeUiLocale("zh-TW")).toBe("zh-CN");
  });
});

describe("resolveUiLocale", () => {
  it("prefers the saved choice over env and device language", () => {
    expect(resolveUiLocale({ stored: "es", envDefault: "pt-BR", deviceLanguage: "en-US" })).toBe(
      "es",
    );
  });

  it("uses the env default, then device language, then English", () => {
    expect(resolveUiLocale({ stored: null, envDefault: "pt-BR", deviceLanguage: "en-US" })).toBe(
      "pt-BR",
    );
    expect(resolveUiLocale({ stored: null, envDefault: null, deviceLanguage: "es-MX" })).toBe("es");
    expect(resolveUiLocale({ stored: null, envDefault: null, deviceLanguage: "de-DE" })).toBe("de");
    expect(resolveUiLocale({ stored: null, envDefault: null, deviceLanguage: "sv-SE" })).toBe("en");
    expect(resolveUiLocale({ stored: null, envDefault: null, deviceLanguage: null })).toBe("en");
  });

  it("falls back to English when the saved choice is a language the app no longer ships", () => {
    expect(resolveUiLocale({ stored: "ru", envDefault: null, deviceLanguage: "pt-BR" })).toBe("en");
  });
});
