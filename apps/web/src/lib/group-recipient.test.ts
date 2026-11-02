import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ThreadSnapshot } from "@corvo/contracts";
import { describe, expect, it } from "vitest";
import { groupRecipientName } from "./group-recipient";
import { UI_LOCALES } from "./ui-locale";

const members = [
  { botId: "manager", name: "Manager" },
  { botId: "designer", name: "Designer" },
] as ThreadSnapshot["members"];
const message = (botId: string | undefined, role = "bot") =>
  ({ id: `${role}-${botId}`, role, botId, blocks: [] }) as never;
const run = (botId: string, status: string, createdAt: string) =>
  ({ id: `run-${botId}`, botId, status, createdAt }) as never;

function snapshot(over: Partial<ThreadSnapshot> = {}): ThreadSnapshot {
  return { members, messages: [], run: null, ...over } as ThreadSnapshot;
}

describe("groupRecipientName", () => {
  it("is the member whose work waits on the person, even if another spoke later", () => {
    const state = snapshot({
      messages: [message("designer"), message("manager")],
      activeRuns: [run("designer", "waiting_takeover", "2026-01-01T00:00:00Z")],
    });
    expect(groupRecipientName(state, "use the app", [])).toBe("Designer");
  });

  it("otherwise is the member who spoke last", () => {
    const state = snapshot({
      messages: [message("manager"), message("designer"), message(undefined, "user")],
    });
    expect(groupRecipientName(state, "and the caption?", [])).toBe("Designer");
  });

  it("is the first member before anyone has spoken", () => {
    expect(groupRecipientName(snapshot(), "hello", [])).toBe("Manager");
  });

  it("follows a mention, typed or picked", () => {
    const state = snapshot({ messages: [message("designer")] });
    expect(groupRecipientName(state, "@Manager what do you think?", [])).toBe("Manager");
    expect(groupRecipientName(state, "what do you think?", ["manager"])).toBe("Manager");
  });

  it("names nobody when more than one member will get it", () => {
    expect(groupRecipientName(snapshot(), "@everyone hi", [])).toBeUndefined();
    expect(groupRecipientName(snapshot(), "@Manager and @Designer", [])).toBeUndefined();
  });

  it("names nobody outside a group", () => {
    expect(groupRecipientName(snapshot({ members: undefined }), "hi", [])).toBeUndefined();
    expect(groupRecipientName(snapshot({ members: [members![0]!] }), "hi", [])).toBeUndefined();
  });

  it("ignores messages from bots that are not members", () => {
    const state = snapshot({ messages: [message("designer"), message("someone-else")] });
    expect(groupRecipientName(state, "hi", [])).toBe("Designer");
  });
});

it("has its line translated in every other language", () => {
  for (const locale of UI_LOCALES.filter((item) => item !== "en")) {
    const catalog = readFileSync(
      fileURLToPath(new URL(`../locales/${locale}/messages.po`, import.meta.url)),
      "utf8",
    );
    const entry = catalog
      .split("\n\n")
      .find((block) => block.includes('msgid "Goes to {recipient}"\n'));
    const translated = entry?.split("msgstr ")[1]?.trim();
    expect(translated, locale).toBeTruthy();
    expect(translated, locale).not.toBe('""');
  }
});
