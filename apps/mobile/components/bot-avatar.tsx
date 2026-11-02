import { avatarWorkingDot, isRunWorking } from "@corvo/core";
import { memo } from "react";
import { Image, View } from "react-native";
import { mobileBotAvatarPresentation } from "../lib/bot-avatar";
import { useI18n } from "../lib/i18n";
import { MASCOT_IMAGES } from "../lib/mascot-images";
import { useMobileTokens } from "../lib/native";
import { NativeSymbol } from "./native-symbol";

export const BotAvatar = memo(function BotAvatar({
  color,
  size = 54,
  status,
  muted = false,
}: {
  color: string;
  size?: number;
  status?: string;
  muted?: boolean;
}) {
  const { t } = useI18n();
  const tokens = useMobileTokens();
  const isWorking = isRunWorking(status);
  // The ring sits outside the disc, so the disc keeps its place.
  const dot = avatarWorkingDot(size);
  const parsed = mobileBotAvatarPresentation(color);
  return (
    <View style={{ width: size, height: size }}>
      {parsed.kind === "image" ? (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: "hidden",
            // A plain circle holds the photo's place while it loads, or if it fails to.
            backgroundColor: tokens.secondary,
          }}
        >
          <Image source={{ uri: parsed.imageUrl }} style={{ width: size, height: size }} />
        </View>
      ) : (
        <Image source={MASCOT_IMAGES[parsed.id]} style={{ width: size, height: size }} />
      )}
      {isWorking ? (
        <View
          accessibilityLabel={t("Working")}
          style={{
            position: "absolute",
            right: muted ? undefined : dot.inset - dot.ring,
            left: muted ? dot.inset - dot.ring : undefined,
            bottom: dot.inset - dot.ring,
            width: dot.diameter + dot.ring * 2,
            height: dot.diameter + dot.ring * 2,
            borderRadius: size,
            borderWidth: dot.ring,
            borderColor: tokens.background,
            backgroundColor: tokens.workingDot,
          }}
        />
      ) : null}
      {muted ? (
        <View
          accessible
          accessibilityLabel={t("Notifications silenced")}
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: Math.max(14, Math.round(size * 0.34)),
            height: Math.max(14, Math.round(size * 0.34)),
            borderRadius: size,
            borderWidth: 2,
            borderColor: "#000",
            backgroundColor: "#242428",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <NativeSymbol
            ios="bell.slash.fill"
            android="notifications-off"
            size={Math.max(8, Math.round(size * 0.17))}
            color="#ECECEE"
          />
        </View>
      ) : null}
    </View>
  );
});
