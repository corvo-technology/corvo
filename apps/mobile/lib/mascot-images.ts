import type { MascotId } from "@corvo/core";
import type { ImageSourcePropType } from "react-native";

/** The mascot each bot color wears; Metro needs every file named in a literal `require`. */
export const MASCOT_IMAGES: Record<MascotId, ImageSourcePropType> = {
  mint: require("../assets/mascot/mint.webp"),
  blue: require("../assets/mascot/blue.webp"),
  violet: require("../assets/mascot/violet.webp"),
  pink: require("../assets/mascot/pink.webp"),
  red: require("../assets/mascot/red.webp"),
  orange: require("../assets/mascot/orange.webp"),
  yellow: require("../assets/mascot/yellow.webp"),
  lime: require("../assets/mascot/lime.webp"),
  cyan: require("../assets/mascot/cyan.webp"),
  neutral: require("../assets/mascot/neutral.webp"),
};
