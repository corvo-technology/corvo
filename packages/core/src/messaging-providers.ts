const PROVIDER_NAMES: Record<string, string> = {
  sendblue: "iMessage",
  slack: "Slack",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  lark: "Feishu",
};

/** The chat apps Rook knows by name; a new one is added to the table above. */
export const MESSAGING_PROVIDER_IDS: readonly string[] = Object.keys(PROVIDER_NAMES);

/** User-facing name of a messaging provider (falls back to the raw id). */
export function messagingProviderName(provider: string): string {
  // Extra named Telegram bots mount as "telegram-<name>".
  const telegramBot = /^telegram-(.+)$/.exec(provider)?.[1];
  if (telegramBot) return `Telegram (${telegramBot})`;
  return PROVIDER_NAMES[provider] ?? provider;
}

/** Per-message provider label, narrowed to a recognized transport when available. */
export function messagingProviderLabel(provider: string, transport?: string): string {
  if (provider === "sendblue" && ["iMessage", "SMS", "RCS"].includes(transport ?? "")) {
    return transport!;
  }
  return messagingProviderName(provider);
}

/** One connection option per app; workspace authorization replaces Slack's code setup. */
export function messagingConnectOptions(
  providers: readonly string[],
  slackInstallAvailable: boolean,
) {
  const available = new Set(providers);
  if (slackInstallAvailable) available.add("slack");
  return [...available].map((provider) => ({
    provider,
    method:
      provider === "slack" && slackInstallAvailable ? ("install" as const) : ("link" as const),
  }));
}

/**
 * A link that opens the chat app with the link code already sent, so linking
 * is one tap. Only Telegram can: opening a bot with `?start=` delivers the
 * code as its first message. Undefined for other apps and until the bot's
 * @username is known.
 */
export function messagingLinkUrl(
  provider: string,
  address: string | undefined,
  code: string,
): string | undefined {
  if (!/^telegram(-|$)/.test(provider)) return undefined;
  const username = /^@([A-Za-z][A-Za-z0-9_]{4,31})$/.exec(address ?? "")?.[1];
  return username ? `https://t.me/${username}?start=${code.replace("-", "")}` : undefined;
}
