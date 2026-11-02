import type { BotColorDef } from "./bot-avatar-colors.js";

/** The Corvo mascot's colors, in the order the avatar picker shows them. `hex` is what a bot saves. */
export const MASCOT_COLORS = [
  { id: "mint", hex: "#10B981" },
  { id: "blue", hex: "#3B82F6" },
  { id: "violet", hex: "#8B5CF6" },
  { id: "pink", hex: "#EC4899" },
  { id: "red", hex: "#EF4444" },
  { id: "orange", hex: "#F97316" },
  { id: "yellow", hex: "#EAB308" },
  { id: "lime", hex: "#84CC16" },
  { id: "cyan", hex: "#06B6D4" },
  { id: "neutral", hex: "#FFFFFF" },
] as const;

export type MascotId = (typeof MASCOT_COLORS)[number]["id"];

/** Where each palette color's mascot comes from; brown has no mascot of its own. */
const MASCOT_BY_PALETTE_ID: Record<string, MascotId> = {
  white: "neutral",
  gray: "neutral",
  violet: "violet",
  green: "mint",
  orange: "orange",
  cyan: "cyan",
  blue: "blue",
  yellow: "yellow",
  brown: "orange",
  red: "red",
  magenta: "pink",
};

/** Hue angle (degrees, HSL) each colored mascot stands for. */
const MASCOT_HUES: ReadonlyArray<readonly [MascotId, number]> = [
  ["red", 0],
  ["orange", 28],
  ["yellow", 48],
  ["lime", 84],
  ["mint", 155],
  ["cyan", 190],
  ["blue", 217],
  ["violet", 262],
  ["pink", 330],
];

const NEUTRAL_SATURATION = 0.14;

function hueAndSaturation(hex: string): { hue: number; saturation: number } {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? [...clean].map((channel) => channel + channel).join("")
      : clean.padEnd(6, "0");
  const [r = 0, g = 0, b = 0] = [0, 2, 4].map(
    (at) => Number.parseInt(full.slice(at, at + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  if (delta === 0) return { hue: 0, saturation };
  const sector =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return { hue: (sector * 60 + 360) % 360, saturation };
}

/** The mascot a bot of this color wears: its palette mascot, else the nearest hue (grays are uncolored). */
export function mascotForColorDef(def: Pick<BotColorDef, "id" | "hex">): MascotId {
  const fromPalette = MASCOT_BY_PALETTE_ID[def.id];
  if (fromPalette) return fromPalette;
  const { hue, saturation } = hueAndSaturation(def.hex);
  if (saturation < NEUTRAL_SATURATION) return "neutral";
  let best: MascotId = "red";
  let bestDistance = 361;
  for (const [id, angle] of MASCOT_HUES) {
    const gap = Math.abs(hue - angle);
    const distance = Math.min(gap, 360 - gap);
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  return best;
}

/** The color a mascot stands for, as a hex value. */
export function mascotHex(id: MascotId): string {
  return MASCOT_COLORS.find((color) => color.id === id)?.hex ?? "#FFFFFF";
}

/** The chick each color wears: its own shade, a crest, and the little things that tell the ten apart. */
export const MASCOT_LOOKS: Record<
  MascotId,
  { color: string; accessory: "headset" | "bow" | null; blush: boolean; sleepy: boolean }
> = {
  mint: { color: "#54c398", accessory: "headset", blush: true, sleepy: false },
  blue: { color: "#75aef5", accessory: null, blush: false, sleepy: false },
  violet: { color: "#b797ef", accessory: "bow", blush: true, sleepy: false },
  pink: { color: "#e788b6", accessory: null, blush: false, sleepy: false },
  red: { color: "#f48877", accessory: null, blush: false, sleepy: true },
  orange: { color: "#e59651", accessory: null, blush: false, sleepy: false },
  lime: { color: "#87bd68", accessory: null, blush: true, sleepy: false },
  yellow: { color: "#cda448", accessory: null, blush: false, sleepy: false },
  cyan: { color: "#4bbdcf", accessory: "bow", blush: false, sleepy: true },
  neutral: { color: "#55555c", accessory: null, blush: false, sleepy: false },
};
