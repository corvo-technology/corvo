import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { UI_LOCALES } from "./ui-locale";

const resources = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "modules/corvo-notifications/android/src/main/res",
);
const keys = [
  "corvo_channel_live",
  "corvo_channel_messages",
  "corvo_channel_scheduled",
  "corvo_channel_attention",
  "corvo_live_one",
  "corvo_live_many",
  "corvo_live_working",
  "corvo_scheduled_title",
  "corvo_replied_group",
  "corvo_replied",
  "corvo_attention_failed",
  "corvo_attention_takeover",
  "corvo_attention_input",
];

const resourceDirectories = {
  en: "values",
  "zh-CN": "values-zh-rCN",
  de: "values-de",
  "pt-BR": "values-pt-rBR",
  es: "values-es",
  ja: "values-ja",
} as const satisfies Record<(typeof UI_LOCALES)[number], string>;

function strings(locale: (typeof UI_LOCALES)[number]) {
  return readFileSync(resolve(resources, resourceDirectories[locale], "strings.xml"), "utf8");
}

describe("Android notification resources", () => {
  it("provides every notification string in each shipped mobile locale", () => {
    for (const locale of UI_LOCALES) {
      const xml = strings(locale);
      for (const key of keys) expect(xml).toContain(`name="${key}"`);
    }
  });

  it("keeps positional format arguments in translated strings", () => {
    expect(strings("pt-BR")).toContain("%1$s e mais %2$d");
    expect(strings("es")).toContain("%1$s y %2$d más");
  });
});
