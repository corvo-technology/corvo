import { describe, expect, it } from "vitest";
import { mobileBotAvatarPresentation } from "./bot-avatar.js";

describe("mobile bot avatar presentation", () => {
  it("shows the mascot of the bot's color, ignoring a shape stored by older bots", () => {
    expect(mobileBotAvatarPresentation("#8B5CF6")).toEqual({ kind: "mascot", id: "violet" });
    expect(mobileBotAvatarPresentation("#8B5CF6::shape_3")).toEqual({
      kind: "mascot",
      id: "violet",
    });
    expect(mobileBotAvatarPresentation("#10B981")).toEqual({ kind: "mascot", id: "mint" });
  });

  it("shows the mascot of a color that wears a character, which only the web draws", () => {
    expect(mobileBotAvatarPresentation("#8B5CF6::char_ghost")).toEqual({
      kind: "mascot",
      id: "violet",
    });
  });

  it("keeps an uploaded picture", () => {
    expect(mobileBotAvatarPresentation("data:image/png;base64,abc")).toEqual({
      kind: "image",
      imageUrl: "data:image/png;base64,abc",
    });
  });

  it("never loads a remote URL; it falls back to a mascot", () => {
    expect(mobileBotAvatarPresentation("https://evil.example/track.png").kind).toBe("mascot");
  });
});
