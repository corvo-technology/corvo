import { describe, expect, it } from "vitest";
import {
  MESSAGING_PROVIDER_IDS,
  messagingConnectOptions,
  messagingLinkUrl,
  messagingProviderLabel,
  messagingProviderName,
} from "./messaging-providers.js";

describe("messaging provider labels", () => {
  it("names known providers and falls back to the raw id", () => {
    expect(messagingProviderName("sendblue")).toBe("iMessage");
    expect(messagingProviderName("telegram")).toBe("Telegram");
    expect(messagingProviderName("teams")).toBe("teams");
  });

  it("names extra Telegram bots after their configured name", () => {
    expect(messagingProviderName("telegram-work")).toBe("Telegram (work)");
    expect(messagingProviderLabel("telegram-work")).toBe("Telegram (work)");
  });

  it("narrows iMessage to its transport", () => {
    expect(messagingProviderLabel("sendblue", "SMS")).toBe("SMS");
    expect(messagingProviderLabel("sendblue", "fax")).toBe("iMessage");
  });
});

it("offers Slack authorization once, including before a workspace is installed", () => {
  expect(messagingConnectOptions(["slack", "telegram", "slack"], true)).toEqual([
    { provider: "slack", method: "install" },
    { provider: "telegram", method: "link" },
  ]);
  expect(messagingConnectOptions([], true)).toEqual([{ provider: "slack", method: "install" }]);
  expect(messagingConnectOptions(["slack"], false)).toEqual([
    { provider: "slack", method: "link" },
  ]);
});

describe("messagingLinkUrl", () => {
  it("opens a Telegram bot with the link code attached", () => {
    expect(messagingLinkUrl("telegram", "@corvo_bot", "ABCD-2345")).toBe(
      "https://t.me/corvo_bot?start=ABCD2345",
    );
    expect(messagingLinkUrl("telegram-work", "@work_bot", "ABCD-2345")).toBe(
      "https://t.me/work_bot?start=ABCD2345",
    );
  });

  it("has no link for other apps or before the bot's username is known", () => {
    expect(messagingLinkUrl("sendblue", "+15555550100", "ABCD-2345")).toBeUndefined();
    expect(messagingLinkUrl("telegram", undefined, "ABCD-2345")).toBeUndefined();
    expect(messagingLinkUrl("telegram", "not a username", "ABCD-2345")).toBeUndefined();
  });
});

describe("the linked WhatsApp provider", () => {
  it("is named WhatsApp, like the official one, and is not offered as a deployment connect option", () => {
    expect(messagingProviderName("whatsapp-web")).toBe("WhatsApp");
    expect(MESSAGING_PROVIDER_IDS).not.toContain("whatsapp-web");
  });
});
