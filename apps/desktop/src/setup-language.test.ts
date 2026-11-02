// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const read = (name: string) => readFileSync(path.join(import.meta.dirname, name), "utf8");

/** Loads the setup window the way Electron does: its page, its text, its script and a stand-in bridge. */
async function openSetup(savedLocale: string | null) {
  const html = read("setup.html");
  document.body.innerHTML = html.slice(html.indexOf("<body>") + 6, html.indexOf("<script"));
  const bridge = {
    platform: "darwin",
    quit: vi.fn(),
    setLocale: vi.fn(async () => undefined),
    save: vi.fn(async () => ({ ok: true })),
    test: vi.fn(async () => ({ ok: true, url: "http://127.0.0.1:1" })),
    state: vi.fn(async () => ({
      locale: { saved: savedLocale, suggested: "en" },
      saved: null,
      defaultLocalUrl: "http://127.0.0.1:45173",
      cloudUrl: "",
      error: null,
    })),
    stack: {
      state: vi.fn(async () => ({ phase: "idle", output: [] })),
      start: vi.fn(async () => ({ phase: "idle", output: [] })),
      onChange: vi.fn(),
    },
  };
  // The page scrolls the chosen language into view, which jsdom does not implement.
  Element.prototype.scrollIntoView = () => undefined;
  const window = globalThis as unknown as Record<string, unknown>;
  window.corvoSetup = bridge;
  // The scripts run as plain scripts in the page, so they are evaluated in this global scope.
  new Function(read("setup-strings.js")).call(globalThis);
  new Function(read("setup.js")).call(globalThis);
  await new Promise((resolve) => setTimeout(resolve, 20));
  return bridge;
}

afterEach(() => {
  document.body.innerHTML = "";
});

const languageChoices = () => document.querySelectorAll("#language-form .choice");

describe("the language step of the setup window", () => {
  it("lists every language on the first launch", async () => {
    await openSetup(null);
    expect(languageChoices()).toHaveLength(7);
  });

  it("lists every language when it is opened again from the title bar", async () => {
    await openSetup("pt-BR");
    expect(document.getElementById("step-language")?.hidden).toBe(true);
    (document.getElementById("change-language") as HTMLButtonElement).click();
    expect(document.getElementById("step-language")?.hidden).toBe(false);
    expect(languageChoices()).toHaveLength(7);
    expect(
      (document.querySelector('#language-form input[value="pt-BR"]') as HTMLInputElement).checked,
    ).toBe(true);
  });
});
