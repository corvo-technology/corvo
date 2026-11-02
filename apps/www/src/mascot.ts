/** The baby crows, one per agent color the app has, in the order its picker shows them. */
export const MASCOT_HUES = [
  "menta",
  "azul",
  "violeta",
  "rosa",
  "vermelho",
  "laranja",
  "amarelo",
  "lima",
  "ciano",
  "neutro",
] as const;

export type MascotHue = (typeof MASCOT_HUES)[number];

/** The baby crow each color wears: its shade and the small things that tell the ten apart. Same as the app's. */
export const MASCOT_LOOK: Record<
  MascotHue,
  { color: string; accessory: "headset" | "bow" | null; blush: boolean; sleepy: boolean }
> = {
  menta: { color: "#54c398", accessory: "headset", blush: true, sleepy: false },
  azul: { color: "#75aef5", accessory: null, blush: false, sleepy: false },
  violeta: { color: "#b797ef", accessory: "bow", blush: true, sleepy: false },
  rosa: { color: "#e788b6", accessory: null, blush: false, sleepy: false },
  vermelho: { color: "#f48877", accessory: null, blush: false, sleepy: true },
  laranja: { color: "#e59651", accessory: null, blush: false, sleepy: false },
  amarelo: { color: "#cda448", accessory: null, blush: false, sleepy: false },
  lima: { color: "#87bd68", accessory: null, blush: true, sleepy: false },
  ciano: { color: "#4bbdcf", accessory: "bow", blush: false, sleepy: true },
  neutro: { color: "#55555c", accessory: null, blush: false, sleepy: false },
};
