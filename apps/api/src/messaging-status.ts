import type { MessagingSurface } from "@corvo/adapter-kit";

/**
 * What the status route reports about messaging. Read per request: a platform
 * learns some facts after boot (Telegram's @username arrives once the bot
 * answers getMe), so a snapshot taken at startup would never show them.
 */
export function messagingStatusSource(
  messaging: MessagingSurface | undefined,
  openSignup: boolean,
) {
  return {
    enabled: Boolean(messaging),
    get providers() {
      return messaging?.platforms().map((platform) => platform.provider) ?? [];
    },
    get addresses() {
      return Object.fromEntries(
        (messaging?.platforms() ?? []).flatMap((platform) =>
          platform.address ? [[platform.provider, platform.address]] : [],
        ),
      );
    },
    openSignup,
  };
}
