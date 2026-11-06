import type { MessagingSurface } from "@corvo/adapter-kit";
import { describe, expect, it } from "vitest";
import { messagingStatusSource } from "./messaging-status.js";

function surface(platforms: () => { provider: string; address?: string }[]) {
  return { platforms: () => platforms() } as unknown as MessagingSurface;
}

describe("messagingStatusSource", () => {
  it("reads addresses when asked, so a Telegram bot's username that arrives after boot is shown", () => {
    let username: string | undefined;
    const source = messagingStatusSource(
      surface(() => [{ provider: "telegram", ...(username ? { address: username } : {}) }]),
      false,
    );
    expect(source.providers).toEqual(["telegram"]);
    expect(source.addresses).toEqual({});
    username = "@corvo_example_bot";
    expect(source.addresses).toEqual({ telegram: "@corvo_example_bot" });
  });

  it("reports a deployment without messaging as disabled and empty", () => {
    expect(messagingStatusSource(undefined, true)).toMatchObject({
      enabled: false,
      providers: [],
      addresses: {},
      openSignup: true,
    });
  });

  it("does not list a linked WhatsApp number as a chat app to connect, and does not turn messaging on by itself", () => {
    const only = messagingStatusSource(
      surface(() => [{ provider: "whatsapp-web" }]),
      false,
    );
    expect(only).toMatchObject({ enabled: false, providers: [], addresses: {} });
    const both = messagingStatusSource(
      surface(() => [{ provider: "telegram" }, { provider: "whatsapp-web" }]),
      false,
    );
    expect(both).toMatchObject({ enabled: true, providers: ["telegram"] });
  });
});
