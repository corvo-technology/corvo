import { ACTIVE_RUN_STATUSES, customMascotBody, MASCOT_COLORS, MASCOT_LOOKS } from "@corvo/core";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  BOT_AVATAR_COLORS,
  BotAvatar,
  DEFAULT_BOT_AVATAR_COLOR,
  defaultBotAvatarValue,
  parseBotAvatar,
  resolvePersonaColorDef,
} from "./bot-avatar.js";

const mascotOf = (html: string) => html.match(/data-mascot="([a-z]+)"/)?.[1];

describe("BotAvatar", () => {
  it("shows a flat tile in the bot's color with two eyes and no picture", () => {
    const html = renderToString(<BotAvatar color="#8B5CF6" size={40} />);
    expect(mascotOf(html)).toBe("violet");
    expect(html).toContain("corvo-mascot-eyes");
    expect(html).toMatch(/style="[^"]*width:40px;height:40px/);
    expect(html).not.toContain("<img");
    expect(html.match(/corvo-mascot-eye-ball/g)).toHaveLength(2);
  });

  it("gives every palette color a tile with eyes", () => {
    for (const color of BOT_AVATAR_COLORS) {
      const html = renderToString(<BotAvatar color={color} />);
      expect(html, color).toContain("corvo-mascot-eyes");
    }
  });

  it("wears the same mascot for an older shape-suffixed value", () => {
    const shaped = renderToString(<BotAvatar color="#8B5CF6::shape_3" />);
    expect(mascotOf(shaped)).toBe("violet");
    expect(shaped).not.toContain("::shape");
  });

  it("uses the nearest mascot for a custom color", () => {
    expect(mascotOf(renderToString(<BotAvatar color="#9ACD32" />))).toBe("lime");
    expect(mascotOf(renderToString(<BotAvatar color="#8A8D8C" />))).toBe("neutral");
  });

  it("paints a color of one's own as the body, and keeps the drawn look of a swatch", () => {
    const own = renderToString(<BotAvatar color="#14B8A6" size={40} />);
    const body = customMascotBody("#14B8A6");
    expect(body).toBeDefined();
    expect(own).toContain(`fill="${body}"`);
    expect(own).not.toContain(MASCOT_LOOKS.cyan.color);

    // The swatches, and the lime that has a mascot but no palette entry, keep the shade they were
    // drawn with.
    for (const { id, hex } of MASCOT_COLORS) {
      const html = renderToString(<BotAvatar color={hex} size={40} />);
      expect(html, id).toContain(`fill="${MASCOT_LOOKS[id].color}"`);
    }
  });

  it("wears the plain chick in a color of one's own, not what the nearest mascot wears", () => {
    // #14B8D6 is nearest to the cyan chick (a bow, sleepy eyes); #18B67C to the mint one
    // (a headset and a blush).
    for (const [own, preset, marks] of [
      ["#14B8D6", "#06B6D4", ["#c5256d"]],
      ["#18B67C", "#10B981", ["#1c1c1e", "#ff82a0"]],
    ] as const) {
      const wornPreset = renderToString(<BotAvatar color={preset} size={40} />);
      const wornOwn = renderToString(<BotAvatar color={own} size={40} />);
      for (const mark of marks) {
        expect(wornPreset, `${preset} wears ${mark}`).toContain(mark);
        expect(wornOwn, `${own} does not wear ${mark}`).not.toContain(mark);
      }
    }
  });

  it.each([...ACTIVE_RUN_STATUSES])(
    "marks active run status %s as working, with a ring",
    (status) => {
      const html = renderToString(<BotAvatar color="#3B82F6" status={status} />);
      expect(html).toContain('data-working="true"');
      expect(html).toContain("corvo-bot-avatar-ring-working");
      expect(html).toContain("stroke-status-working");
    },
  );

  it("is ring-free when idle", () => {
    const html = renderToString(<BotAvatar color="#F59E0B" status="idle" />);
    expect(html).toContain('data-working="false"');
    expect(html).not.toContain("corvo-bot-avatar-ring");
  });

  it("never draws the old shapes or eyes", () => {
    const html = renderToString(<BotAvatar color="#8B5CF6" identity="maya" status="running" />);
    expect(html).not.toContain("<path");
    expect(html).not.toContain("corvo-organic-avatar");
    expect(html).not.toContain("bot-character-eyes");
  });

  it("renders uploaded images as a round photo, not a mascot", () => {
    const html = renderToString(
      <BotAvatar color="data:image/png;base64,abc" identity="maya" size={32} />,
    );
    expect(html).toContain("corvo-bot-avatar-picture");
    expect(html).toContain('src="data:image/png;base64,abc"');
    expect(html).not.toContain("data-mascot");
  });

  it("keeps a working photo ring outside the clipped image and uses the status token", () => {
    const html = renderToString(
      <BotAvatar color="data:image/png;base64,abc" identity="maya" size={32} status="running" />,
    );
    expect(html).toContain('class="corvo-bot-avatar relative shrink-0 select-none"');
    expect(html).toContain("corvo-bot-avatar-ring-working");
    expect(html).toContain("stroke-status-working");
    expect(html.indexOf("corvo-bot-avatar-picture")).toBeLessThan(
      html.indexOf("corvo-bot-avatar-ring"),
    );
  });

  it("keeps idle photo avatars ring-free", () => {
    const html = renderToString(
      <BotAvatar color="data:image/png;base64,abc" identity="maya" size={32} status="idle" />,
    );
    expect(html).toContain('data-working="false"');
    expect(html).not.toContain("corvo-bot-avatar-ring");
  });

  it("does not treat arbitrary http(s) color values as remote images", () => {
    const parsed = parseBotAvatar("https://evil.example/track.png");
    expect(parsed.isImage).toBe(false);
    expect(parsed.imageUrl).toBeUndefined();
    const html = renderToString(
      <BotAvatar color="https://evil.example/track.png" identity="maya" size={32} />,
    );
    expect(html).not.toContain("evil.example");
    expect(html).toContain("corvo-mascot-eyes");
  });
});

describe("parseBotAvatar", () => {
  it("drops a shape suffix and keeps the color", () => {
    expect(parseBotAvatar(`${DEFAULT_BOT_AVATAR_COLOR}::shape_3`)).toEqual({
      color: DEFAULT_BOT_AVATAR_COLOR,
      isImage: false,
    });
    expect(parseBotAvatar("#10B981::shape_oops").color).toBe("#10B981");
  });

  it("falls back to orange for an empty value", () => {
    expect(parseBotAvatar("").color).toBe("#F97316");
  });
});

describe("defaultBotAvatarValue", () => {
  it("keeps a valid hex and drops the suffix", () => {
    expect(defaultBotAvatarValue("#10B981::shape_2")).toBe("#10B981");
  });

  it("falls back to the default color for an image or an invalid value", () => {
    expect(defaultBotAvatarValue("data:image/png;base64,abc")).toBe(DEFAULT_BOT_AVATAR_COLOR);
    expect(defaultBotAvatarValue("not-a-color")).toBe(DEFAULT_BOT_AVATAR_COLOR);
  });
});

describe("resolvePersonaColorDef", () => {
  it("falls back to the identity palette for invalid custom hex", () => {
    expect(resolvePersonaColorDef("bot", "#zzzzzz")).toEqual(resolvePersonaColorDef("bot"));
    expect(resolvePersonaColorDef("bot", "#ggg")).toEqual(resolvePersonaColorDef("bot"));
  });
});

describe("the mascot's eyes", () => {
  const moodOf = (html: string) => html.match(/data-mood="([a-z]+)"/)?.[1];

  it("are drawn over the tile, white with a pupil that can move", () => {
    const html = renderToString(<BotAvatar color="#3B82F6" />);
    expect(html).toContain("corvo-mascot-eyes");
    expect(html).toContain("corvo-mascot-eye-ball");
    expect(html).toContain("corvo-mascot-eye-light");
    expect(moodOf(html)).toBe("idle");
  });

  it.each([
    ["running", "thinking"],
    ["queued", "thinking"],
    ["waiting_input", "alert"],
    ["waiting_takeover", "alert"],
    ["failed", "failed"],
    ["idle", "idle"],
  ])("show the mood of status %s as %s", (status, mood) => {
    expect(moodOf(renderToString(<BotAvatar color="#3B82F6" status={status} />))).toBe(mood);
  });

  it("blink on a beat of their own, different for each agent", () => {
    const beat = (identity: string) =>
      renderToString(<BotAvatar color="#3B82F6" identity={identity} />)
        .match(/--blink-every:([^;"]+);--blink-delay:([^;"]+)/)
        ?.slice(1, 3);
    expect(beat("bot-a")).toBeDefined();
    expect(beat("bot-a")).toEqual(beat("bot-a"));
    expect(beat("bot-a")).not.toEqual(beat("bot-b"));
  });

  it("fill the tile with the shade of the chick the bot's color gives it", () => {
    expect(renderToString(<BotAvatar color="#8B5CF6" />)).toContain('fill="#b797ef"');
    expect(renderToString(<BotAvatar color="#10B981" />)).toContain('fill="#54c398"');
  });
});

describe("the chick", () => {
  it("has a beak and two eyes", () => {
    const html = renderToString(<BotAvatar color="#3B82F6" size={40} />);
    expect(html).toContain('fill="#f9b64f"');
    expect(html.match(/corvo-mascot-eye-ball/g)).toHaveLength(2);
  });

  it("wears a crest and its accessory when big enough to see them", () => {
    const big = renderToString(<BotAvatar color="#8B5CF6" size={48} />);
    expect(big).toContain("corvo-mascot-crest");
    expect(big).toContain('fill="#c5256d"');
    const headset = renderToString(<BotAvatar color="#10B981" size={48} />);
    expect(headset).toContain('fill="#1c1c1e"');
  });

  it("is a plain tile with a beak when too small for the fine parts", () => {
    const small = renderToString(<BotAvatar color="#8B5CF6" size={22} />);
    expect(small).not.toContain("corvo-mascot-crest");
    expect(small).not.toContain('fill="#c5256d"');
  });

  it("sleeps with a thin line for eyes when its look says so", () => {
    const sleepy = renderToString(<BotAvatar color="#EF4444" size={40} />);
    expect(sleepy).not.toContain("corvo-mascot-eye-light");
  });
});
