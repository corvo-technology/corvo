import type { MessagingStatus } from "@corvo/contracts";
import { messagingConnectOptions, messagingLinkUrl } from "@corvo/core";
import { fetchFresh } from "@corvo/core/query";
import { Button } from "@corvo/ui-web";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { providerLabel } from "../lib/messaging";
import { useSpaceQueries } from "../lib/query";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";
import { AppLetter, StoreAppHeader } from "./StoreAppHeader";

const LINK_POLL_MS = 3_000;

type LinkRequest = { code: string; expiresAt: string; provider: string };

/**
 * Chat apps people already have, connected from Integrations like any other
 * app: one press opens the chat with the link code attached, and the row
 * turns to Connected once the chat app confirms it.
 */
export function ChatAppsRow({
  botId,
  query,
  only,
  onOpen,
  onBack,
  connectedInSidebar,
}: {
  botId: string | undefined;
  query: string;
  /** Show just this chat app, as its own screen. */
  only?: string;
  /** In the list, choosing a chat app opens its own screen. */
  onOpen?: (provider: string) => void;
  /** On its own screen, the way back to the list. */
  onBack?: () => void;
  /** Wide screens list connected chat apps in the Store's side column, so their rows are hidden here. */
  connectedInSidebar?: boolean;
}) {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const statusOptions = useSpaceQueries().messaging.status.queryOptions();
  const status: MessagingStatus | undefined = useQuery(statusOptions).data;
  const [request, setRequest] = useState<LinkRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const linked = (provider: string) =>
    status?.identities.find(
      (identity) => identity.provider === provider && identity.botId === botId,
    );

  // Linking completes in the chat app, so watch for the new identity.
  useEffect(() => {
    if (!request) return;
    let active = true;
    let poll = 0;
    const expire = window.setTimeout(
      () => {
        active = false;
        window.clearTimeout(poll);
        setRequest(null);
      },
      Math.max(0, Date.parse(request.expiresAt) - Date.now()),
    );
    async function check() {
      try {
        const next = await fetchFresh(queryClient, statusOptions);
        if (!active) return;
        if (
          next.identities.some(
            (identity) => identity.provider === request?.provider && identity.botId === botId,
          )
        ) {
          active = false;
          window.clearTimeout(expire);
          setRequest(null);
        }
      } catch {
        // A transient failure is retried while the code is valid.
      } finally {
        if (active) poll = window.setTimeout(() => void check(), LINK_POLL_MS);
      }
    }
    poll = window.setTimeout(() => void check(), LINK_POLL_MS);
    return () => {
      active = false;
      window.clearTimeout(poll);
      window.clearTimeout(expire);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, botId]);

  const providers = messagingConnectOptions(
    (status?.providers ?? []).filter((provider) => provider !== "slack"),
    false,
  )
    .map(({ provider }) => provider)
    .filter((provider) => !only || provider === only)
    .filter((provider) =>
      providerLabel(provider).toLowerCase().includes(query.trim().toLowerCase()),
    );
  if (!botId || providers.length === 0) return null;

  async function connect(provider: string) {
    setError(null);
    try {
      const issued = await rpc.messaging.link.start({ botId: botId! });
      setRequest({ ...issued, provider });
      // The bot's username may have arrived since this screen first loaded.
      const latest = await fetchFresh(queryClient, statusOptions).catch(() => status);
      const url = messagingLinkUrl(provider, latest?.addresses?.[provider], issued.code);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(errorText(err, t`Could not connect`));
    }
  }

  async function unlink(identityId: string) {
    setError(null);
    try {
      await rpc.messaging.identities.unlink({ identityId });
      await fetchFresh(queryClient, statusOptions);
    } catch (err) {
      setError(errorText(err, t`Could not connect`));
    }
  }

  if (only) {
    const identity = linked(only);
    const name = providerLabel(only);
    const pending = request?.provider === only ? request : null;
    // These names are the placeholders of the existing translated sentences.
    const linkApp = name;
    const linkAddress = status?.addresses?.[only];
    const linkCode = pending?.code ?? "";
    const url = pending ? messagingLinkUrl(only, linkAddress, linkCode) : undefined;
    return (
      <div className="space-y-5" data-testid={`chat-app-${only}`}>
        <StoreAppHeader
          name={name}
          onBack={() => onBack?.()}
          action={
            identity ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void unlink(identity.id)}
              >
                <Trans>Unlink</Trans>
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending !== null}
                onClick={() => void connect(only)}
              >
                <Trans>Connect</Trans>
              </Button>
            )
          }
        />
        {identity ? (
          <p className="px-1 text-[13px] text-muted-foreground">
            <Trans>Connected</Trans>
          </p>
        ) : null}
        {pending ? (
          <div className="space-y-2 px-1" data-testid="chat-app-code">
            {url ? (
              <Button
                type="button"
                size="sm"
                onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
              >
                <Trans>Open {name}</Trans>
              </Button>
            ) : null}
            <p className="text-[14px] text-foreground/75">
              {linkAddress ? (
                <Trans>
                  Send <span className="font-mono text-foreground">{linkCode}</span> to{" "}
                  <span className="text-foreground">{linkAddress}</span> from {linkApp} within 10
                  minutes.
                </Trans>
              ) : (
                <Trans>
                  Send <span className="font-mono text-foreground">{linkCode}</span> from {linkApp}{" "}
                  within 10 minutes.
                </Trans>
              )}
            </p>
          </div>
        ) : null}
        {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div
      className={`space-y-1 ${
        connectedInSidebar && providers.every((provider) => linked(provider)) ? "md:hidden" : ""
      }`}
      data-testid="chat-apps"
    >
      {providers.map((provider) => {
        const identity = linked(provider);
        const name = providerLabel(provider);
        return (
          <button
            key={provider}
            type="button"
            data-testid={`chat-app-${provider}`}
            className={`flex w-full min-w-0 items-center gap-3 rounded-xl px-2.5 py-2 text-start hover:bg-accent/60 focus-visible:outline-2 ${
              identity && connectedInSidebar ? "md:hidden" : ""
            }`}
            onClick={() => onOpen?.(provider)}
          >
            <AppLetter name={name} />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{name}</span>
            {identity ? (
              <span className="shrink-0 text-[12.5px] text-muted-foreground">
                <Trans>Connected</Trans>
              </span>
            ) : null}
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
