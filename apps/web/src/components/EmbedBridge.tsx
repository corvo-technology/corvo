import { useEffect } from "react";
import {
  applyEmbedAccent,
  exchangeEmbedCode,
  installEmbedToken,
  parseEmbedMessage,
  scheduleEmbedRefresh,
  tellParent,
} from "../lib/embed";
import { activateUiLocale } from "../lib/i18n";
import { applyUiAppearance } from "../lib/ui-appearance";

/**
 * Listens to the partner's page for the few things it may say: a new look, a new accent, a new language, and a
 * fresh code when the frame asked for one. Only the page that frames this one is heard, and
 * nothing it sends can reach the session.
 */
export function EmbedBridge() {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      const message = parseEmbedMessage(event.data);
      if (!message) return;
      if (message.type === "config") {
        if (message.theme) applyUiAppearance(message.theme === "auto" ? "system" : message.theme);
        if (message.locale) void activateUiLocale(message.locale);
        applyEmbedAccent(message.accent);
        return;
      }
      void exchangeEmbedCode(message.code).then((session) => {
        if (!session) return tellParent({ type: "corvo:expired" });
        installEmbedToken(session.token);
        scheduleEmbedRefresh(session.expiresAt);
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);
  return null;
}
