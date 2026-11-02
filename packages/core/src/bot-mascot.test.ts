import { describe, expect, it } from "vitest";
import { BOT_COLOR_LIST, resolvePersonaColorDef } from "./bot-avatar-colors.js";
import { MASCOT_COLORS, MASCOT_LOOKS, mascotForColorDef, mascotHex } from "./bot-mascot.js";

describe("mascotForColorDef", () => {
  it("gives every palette color a mascot", () => {
    const byId = Object.fromEntries(BOT_COLOR_LIST.map((def) => [def.id, mascotForColorDef(def)]));
    expect(byId).toEqual({
      white: "neutral",
      violet: "violet",
      green: "mint",
      orange: "orange",
      cyan: "cyan",
      blue: "blue",
      yellow: "yellow",
      brown: "orange",
      red: "red",
      magenta: "pink",
      gray: "neutral",
    });
  });

  it("gives each mascot swatch back its own mascot", () => {
    for (const color of MASCOT_COLORS) {
      expect(mascotForColorDef(resolvePersonaColorDef("any", color.hex)), color.id).toBe(color.id);
    }
  });

  it("picks the nearest hue for a custom color", () => {
    const custom = (hex: string) => mascotForColorDef(resolvePersonaColorDef("any", hex));
    expect(custom("#FF0000")).toBe("red");
    expect(custom("#9ACD32")).toBe("lime");
    expect(custom("#1E90FF")).toBe("blue");
    expect(custom("#FF1493")).toBe("pink");
  });

  it("uses the uncolored mascot for grays and near-grays", () => {
    const custom = (hex: string) => mascotForColorDef(resolvePersonaColorDef("any", hex));
    expect(custom("#808080")).toBe("neutral");
    expect(custom("#8A8D8C")).toBe("neutral");
  });
});

describe("the mascot colors", () => {
  it("knows the color each mascot stands for", () => {
    expect(mascotHex("violet")).toBe("#8B5CF6");
    expect(mascotHex("neutral")).toBe("#FFFFFF");
  });
});

describe("the chick of each mascot", () => {
  it("has a look for every color, each in a shade of its own", () => {
    const shades = MASCOT_COLORS.map(({ id }) => MASCOT_LOOKS[id].color);
    expect(new Set(shades).size).toBe(MASCOT_COLORS.length);
    for (const shade of shades) expect(shade).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("keeps the uncolored chick graphite, so a white one is never lost on a white page", () => {
    expect(MASCOT_LOOKS.neutral.color).toBe("#55555c");
  });
});
