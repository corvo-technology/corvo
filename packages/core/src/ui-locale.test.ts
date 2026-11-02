import { describe, expect, it } from "vitest";
import { matchUiLocale } from "./ui-locale.js";

const ALL = ["en", "pt-BR", "es"] as const;
const FEW = ["en", "es"] as const;

describe("matchUiLocale", () => {
  it("maps regional, underscored, and cased tags onto a supported locale", () => {
    expect(matchUiLocale("en-GB", ALL)).toBe("en");
    expect(matchUiLocale(" ES ", ALL)).toBe("es");
    expect(matchUiLocale("es_AR", ALL)).toBe("es");
    expect(matchUiLocale("es-419", ALL)).toBe("es");
    expect(matchUiLocale("pt", ALL)).toBe("pt-BR");
    expect(matchUiLocale("pt-PT", ALL)).toBe("pt-BR");
  });

  it("falls back to English for locales the surface does not ship", () => {
    expect(matchUiLocale("pt-BR", FEW)).toBe("en");
    expect(matchUiLocale("de-DE", ALL)).toBe("en");
    expect(matchUiLocale("zh-CN", ALL)).toBe("en");
    expect(matchUiLocale("iw", ALL)).toBe("en");
    expect(matchUiLocale("sv-SE", ALL)).toBe("en");
    expect(matchUiLocale("", ALL)).toBe("en");
    expect(matchUiLocale(null, ALL)).toBe("en");
  });
});
