import type { McpServer } from "@corvo/contracts";
import { APP_CATALOG } from "@corvo/core";
import { Button } from "@corvo/ui-web";
import { Trans } from "@lingui/react/macro";
import { MessageCircle, Plug } from "lucide-react";
import { useState } from "react";

function AppMark({ server }: { server: McpServer }) {
  const [failed, setFailed] = useState(false);
  const iconUrl = APP_CATALOG.find((entry) => entry.slug === server.slug)?.iconUrl;
  return iconUrl && !failed ? (
    <img
      src={iconUrl}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="size-6 shrink-0 rounded-md bg-accent object-contain"
      onError={() => setFailed(true)}
    />
  ) : (
    <Plug className="size-6 shrink-0 text-muted-foreground" strokeWidth={1.5} />
  );
}

/** The apps the person has added, in the Store's side column. Choosing one opens it in Apps. */
export function StoreInstalledApps({
  servers,
  chatApps = [],
  onOpen,
  onOpenChat,
  onManage,
}: {
  servers: readonly McpServer[];
  /** Connected chat apps, by provider id and name. */
  chatApps?: ReadonlyArray<{ provider: string; label: string }>;
  onOpen: (server: McpServer) => void;
  onOpenChat?: (provider: string) => void;
  onManage?: () => void;
}) {
  if (servers.length === 0 && chatApps.length === 0) return null;
  return (
    <div data-testid="store-installed-apps" className="hidden min-h-0 flex-1 flex-col md:flex">
      <div className="px-3 pt-6 pb-2 text-[13px] text-muted-foreground">
        <Trans>Your apps</Trans>
      </div>
      <div className="rk-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {chatApps.map((chat) => (
          <Button
            key={chat.provider}
            type="button"
            variant="ghost"
            className="h-10 justify-start gap-3 px-3 font-normal"
            onClick={() => onOpenChat?.(chat.provider)}
          >
            <MessageCircle className="size-6 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <span className="min-w-0 truncate">{chat.label}</span>
          </Button>
        ))}
        {servers.map((server) => (
          <Button
            key={server.id}
            type="button"
            variant="ghost"
            className="h-10 justify-start gap-3 px-3 font-normal"
            onClick={() => onOpen(server)}
          >
            <AppMark server={server} />
            <span className="min-w-0 flex-1 truncate text-start">{server.name}</span>
            {!server.enabled ? (
              <span className="shrink-0 text-[12px] text-muted-foreground">
                <Trans>Disabled</Trans>
              </span>
            ) : server.oauthStatus === "reconnect" ? (
              <span className="shrink-0 text-[12px] text-destructive">
                <Trans>OAuth expired</Trans>
              </span>
            ) : null}
          </Button>
        ))}
      </div>
      {onManage ? (
        <Button
          type="button"
          variant="link"
          size="xs"
          className="justify-start px-3 py-2 text-muted-foreground"
          onClick={onManage}
        >
          <Trans>Manage MCP servers</Trans>
        </Button>
      ) : null}
    </div>
  );
}
