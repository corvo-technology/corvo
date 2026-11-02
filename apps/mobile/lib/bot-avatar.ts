import { parseBotAvatarValue } from "@corvo/contracts";
import type { MascotId } from "@corvo/core";
import { DEFAULT_BOT_AVATAR_COLOR, mascotForColorDef, resolvePersonaColorDef } from "@corvo/core";

export type MobileBotAvatarPresentation =
  | { kind: "image"; imageUrl: string }
  | { kind: "mascot"; id: MascotId };

/** What a stored `bots.color` value shows: an uploaded picture, else the mascot of its color. */
export function mobileBotAvatarPresentation(color: string): MobileBotAvatarPresentation {
  const parsed = parseBotAvatarValue(color);
  if (parsed.kind === "image" && parsed.imageUrl) {
    return { kind: "image", imageUrl: parsed.imageUrl };
  }
  const hex =
    parsed.kind === "shape" || parsed.kind === "color" ? parsed.color : DEFAULT_BOT_AVATAR_COLOR;
  return { kind: "mascot", id: mascotForColorDef(resolvePersonaColorDef("preview", hex)) };
}
