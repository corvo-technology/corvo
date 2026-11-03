import { mascotHex } from "@corvo/core";
import { BotAvatar } from "@corvo/ui-web";

/** Ana, the Rook baby crow, for the places that introduce the app. */
export function BrandMascot({ size, className }: { size: number; className?: string }) {
  return <BotAvatar color={mascotHex("mint")} identity="corvo" size={size} className={className} />;
}
