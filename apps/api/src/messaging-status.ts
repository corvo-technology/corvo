import type { MessagingSurface } from "@corvo/adapter-kit";
import { WHATSAPP_LINK_PROVIDER } from "@corvo/adapters";

/**
 * What the status route reports about messaging. Read per request: a platform
 * learns some facts after boot (Telegram's @username arrives once the bot
 * answers getMe), so a snapshot taken at startup would never show them.
 */
export function messagingStatusSource(
  messaging: MessagingSurface | undefined,
  openSignup: boolean,
) {
  // A number linked by QR has its own screen and cannot be connected with a code, so it is not a
  // chat app to offer, and the app having it does not turn messaging on.
  const offered = () =>
    (messaging?.platforms() ?? []).filter(
      (platform) => platform.provider !== WHATSAPP_LINK_PROVIDER,
    );
  return {
    get enabled() {
      return Boolean(messaging) && offered().length > 0;
    },
    get providers() {
      return offered().map((platform) => platform.provider);
    },
    get addresses() {
      return Object.fromEntries(
        offered().flatMap((platform) =>
          platform.address ? [[platform.provider, platform.address]] : [],
        ),
      );
    },
    openSignup,
  };
}
