import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateUiLocale,
  getActiveUiLocale,
  i18n,
  setCatalogLoadersForTests,
  setUiLocale,
} from "./i18n";
import { UI_LOCALE_STORAGE_KEY } from "./ui-locale";

vi.mock("./apply-ui-direction", () => ({
  applyUiDirection: vi.fn(),
}));

function stubLocaleStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: () => null,
    length: 0,
  });
  return store;
}

type Catalog = { messages: Record<string, string> };

/** Locales a case does not exercise: never loaded, so they fail if they are. */
const notLoaded = async () => {
  throw new Error("not expected to load");
};
const otherLocales = { de: notLoaded, fr: notLoaded, ja: notLoaded, "zh-CN": notLoaded };

describe("activateUiLocale", () => {
  beforeEach(() => {
    setCatalogLoadersForTests(null);
    i18n.load("en", {});
    i18n.activate("en");
    vi.unstubAllGlobals();
  });

  it("falls back to English when the preferred catalog fails to load", async () => {
    setCatalogLoadersForTests({
      ...otherLocales,
      en: async () => ({ messages: { Settings: "Settings" } }),
      "pt-BR": async () => {
        throw new Error("pt-BR catalog missing");
      },
      es: async () => ({ messages: { Settings: "Configuración" } }),
    });

    const locale = await activateUiLocale("pt-BR");
    expect(locale).toBe("en");
    expect(getActiveUiLocale()).toBe("en");
    expect(i18n.locale).toBe("en");
    expect(i18n._({ id: "Settings", message: "Settings" })).toBe("Settings");
  });

  it("falls back to empty English when every catalog fails", async () => {
    setCatalogLoadersForTests({
      ...otherLocales,
      en: async () => {
        throw new Error("en missing");
      },
      "pt-BR": async () => {
        throw new Error("pt-BR missing");
      },
      es: async () => {
        throw new Error("es missing");
      },
    });

    const locale = await activateUiLocale("es");
    expect(locale).toBe("en");
    expect(i18n.locale).toBe("en");
  });

  it("lets the latest locale selection win under concurrency", async () => {
    let resolvePt!: (value: Catalog) => void;
    const ptPromise = new Promise<Catalog>((resolve) => {
      resolvePt = resolve;
    });

    setCatalogLoadersForTests({
      ...otherLocales,
      en: async () => ({ messages: { Settings: "Settings" } }),
      "pt-BR": async () => ptPromise,
      es: async () => ({ messages: { Settings: "Configuración" } }),
    });

    const first = activateUiLocale("pt-BR");
    const second = activateUiLocale("es");
    resolvePt({ messages: { Settings: "Configurações" } });

    await expect(first).resolves.toBe("es");
    await expect(second).resolves.toBe("es");
    expect(getActiveUiLocale()).toBe("es");
    expect(i18n._({ id: "Settings", message: "Settings" })).toBe("Configuración");
  });

  it("cancels a pending activation when re-selecting the already-active locale", async () => {
    let resolvePt!: (value: Catalog) => void;
    const ptPromise = new Promise<Catalog>((resolve) => {
      resolvePt = resolve;
    });

    setCatalogLoadersForTests({
      ...otherLocales,
      en: async () => ({ messages: { Settings: "Settings" } }),
      "pt-BR": async () => ptPromise,
      es: async () => ({ messages: { Settings: "Configuración" } }),
    });

    await activateUiLocale("en");
    expect(getActiveUiLocale()).toBe("en");

    const pendingPt = activateUiLocale("pt-BR");
    const backToEn = activateUiLocale("en");
    resolvePt({ messages: { Settings: "Configurações" } });

    await expect(pendingPt).resolves.toBe("en");
    await expect(backToEn).resolves.toBe("en");
    expect(getActiveUiLocale()).toBe("en");
    expect(i18n.locale).toBe("en");
    expect(i18n._({ id: "Settings", message: "Settings" })).toBe("Settings");
  });

  it("does not let a stale setUiLocale fallback overwrite the latest stored locale", async () => {
    const store = stubLocaleStorage();
    let resolvePt!: (value: Catalog) => void;
    const ptPromise = new Promise<Catalog>((resolve) => {
      resolvePt = resolve;
    });

    setCatalogLoadersForTests({
      ...otherLocales,
      en: async () => ({ messages: { Settings: "Settings" } }),
      "pt-BR": async () => ptPromise,
      es: async () => ({ messages: { Settings: "Configuración" } }),
    });

    await activateUiLocale("en");
    const pendingPt = setUiLocale("pt-BR");
    const pendingEs = setUiLocale("es");
    expect(store.get(UI_LOCALE_STORAGE_KEY)).toBe("es");

    resolvePt({ messages: { Settings: "Configurações" } });
    await expect(pendingPt).resolves.toBe("es");
    await expect(pendingEs).resolves.toBe("es");
    expect(getActiveUiLocale()).toBe("es");
    expect(store.get(UI_LOCALE_STORAGE_KEY)).toBe("es");
  });
});
