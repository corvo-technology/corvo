import type { WhatsAppNumber } from "@corvo/contracts";
import { Button } from "@corvo/ui-web";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { encode } from "uqr";
import { useSpaceQueries } from "../lib/query";
import { rpc } from "../lib/rpc";
import { errorText } from "../lib/user-error";

const LINK_POLL_MS = 1_500;

/** The QR code WhatsApp shows to link a device, drawn as one path so it scans in any theme. */
function Qr({ text }: { text: string }) {
  const { t } = useLingui();
  const { data, path } = useMemo(() => {
    const { data: cells } = encode(text, { ecc: "L", border: 2 });
    const dark: string[] = [];
    cells.forEach((row, y) => {
      row.forEach((on, x) => {
        if (on) dark.push(`M${x} ${y}h1v1h-1z`);
      });
    });
    return { data: cells, path: dark.join("") };
  }, [text]);
  return (
    <svg
      data-testid="whatsapp-qr"
      role="img"
      aria-label={t`QR code`}
      viewBox={`0 0 ${data.length} ${data.length}`}
      shapeRendering="crispEdges"
      className="size-56 rounded-xl"
    >
      {/* A scanner needs dark on light whatever the theme is. */}
      <rect width={data.length} height={data.length} fill="white" />
      <path d={path} fill="black" />
    </svg>
  );
}

function NumberRow({ number }: { number: WhatsAppNumber }) {
  const { t } = useLingui();
  const queries = useSpaceQueries();
  const queryClient = useQueryClient();
  const numbersKey = queries.messaging.whatsapp.numbers.list.queryOptions().queryKey;
  const bots = (useQuery(queries.bots.list.queryOptions()).data ?? []).filter(
    (bot) => !bot.archivedAt,
  );
  const connections = useQuery(queries.connections.list.queryOptions()).data ?? [];
  const [error, setError] = useState<string | null>(null);

  // One button per connected app, by the name the person knows it by.
  const apps = [
    ...new Map(connections.map((connection) => [connection.provider, connection.displayName])),
  ];

  async function change(input: Parameters<typeof rpc.messaging.whatsapp.numbers.update>[0]) {
    setError(null);
    try {
      await rpc.messaging.whatsapp.numbers.update(input);
      await queryClient.invalidateQueries({ queryKey: numbersKey });
    } catch (err) {
      setError(errorText(err, t`Could not update`));
    }
  }

  async function remove() {
    setError(null);
    try {
      await rpc.messaging.whatsapp.numbers.disconnect({ id: number.id });
      await queryClient.invalidateQueries({ queryKey: numbersKey });
    } catch (err) {
      setError(errorText(err, t`Could not disconnect`));
    }
  }

  return (
    <div data-testid={`whatsapp-number-${number.id}`} className="space-y-2 rounded-xl px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{number.number}</span>
        {number.status === "disconnected" ? (
          <span className="shrink-0 text-[12.5px] text-muted-foreground">
            <Trans>Disconnected</Trans>
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void change({ id: number.id, paused: !number.paused })}
          >
            {number.paused ? <Trans>Resume</Trans> : <Trans>Pause</Trans>}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={() => void remove()}>
          <Trans>Disconnect</Trans>
        </Button>
      </div>
      {bots.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {bots.map((bot) => (
            <Button
              key={bot.id}
              type="button"
              variant={bot.id === number.botId ? "default" : "outline"}
              size="xs"
              aria-pressed={bot.id === number.botId}
              onClick={() =>
                bot.id !== number.botId && void change({ id: number.id, botId: bot.id })
              }
            >
              {bot.id === number.botId ? <Check aria-hidden="true" /> : null}
              {bot.name}
            </Button>
          ))}
        </div>
      ) : number.botName ? (
        <div className="text-[13px] text-muted-foreground">{number.botName}</div>
      ) : null}
      {apps.length > 0 ? (
        <div className="space-y-1">
          <div className="text-[13px] text-muted-foreground">
            <Trans>Apps visitors can use</Trans>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {apps.map(([provider, name]) => {
              const on = number.visitorConnectors.includes(provider);
              return (
                <Button
                  key={provider}
                  type="button"
                  variant={on ? "default" : "outline"}
                  size="xs"
                  aria-pressed={on}
                  onClick={() =>
                    void change({
                      id: number.id,
                      visitorConnectors: (on
                        ? number.visitorConnectors.filter((entry) => entry !== provider)
                        : [...number.visitorConnectors, provider]
                      ).sort(),
                    })
                  }
                >
                  {on ? <Check aria-hidden="true" /> : null}
                  {name}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}
      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
    </div>
  );
}

/**
 * WhatsApp as an app: Add links another number, by QR, to the open agent; each linked number is
 * listed with its agent and the apps its agent may use with visitors.
 */
export function WhatsAppNumbers({ botId }: { botId: string | undefined }) {
  const { t } = useLingui();
  const queries = useSpaceQueries();
  const queryClient = useQueryClient();
  const listOptions = queries.messaging.whatsapp.numbers.list.queryOptions();
  const list = useQuery(listOptions).data;
  const [link, setLink] = useState<{ id: string; qr?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const linkId = link?.id;
  // Read fresh by the watcher below without restarting it each time the screen renders.
  const refreshNumbers = useRef(() => Promise.resolve());
  refreshNumbers.current = () => queryClient.invalidateQueries({ queryKey: listOptions.queryKey });
  const failedText = t`Could not connect`;
  const failedTextRef = useRef(failedText);
  failedTextRef.current = failedText;

  // The scan happens on the phone, so watch the link until it settles.
  useEffect(() => {
    if (!linkId) return;
    let active = true;
    const check = async () => {
      try {
        const status = await rpc.messaging.whatsapp.link.status({ linkId });
        if (!active) return;
        if (status.state === "qr") {
          setLink((current) => (current?.id === linkId ? { id: linkId, qr: status.qr } : current));
        } else if (status.state === "linked") {
          setLink(null);
          await refreshNumbers.current();
        } else {
          setLink(null);
          setError(failedTextRef.current);
        }
      } catch {
        // A poll that fails once is tried again on the next tick.
      }
    };
    // Look at once, so the QR code shows as soon as it exists, then keep watching.
    void check();
    const poll = window.setInterval(() => void check(), LINK_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, [linkId]);

  if (!list?.available) return null;

  async function add() {
    if (!botId) return;
    setError(null);
    try {
      const started = await rpc.messaging.whatsapp.link.start({ botId });
      setLink({ id: started.linkId });
    } catch (err) {
      setError(errorText(err, t`Could not connect`));
    }
  }

  return (
    <div className="mb-6 space-y-1" data-testid="whatsapp-numbers">
      <div className="flex min-w-0 items-center gap-3 rounded-xl px-2.5 py-2">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-sm font-semibold text-foreground">
          W
        </div>
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">WhatsApp</span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!botId || link !== null}
          onClick={() => void add()}
        >
          <Trans>Add</Trans>
        </Button>
      </div>
      {link ? (
        <div className="space-y-3 px-2.5 pb-2" data-testid="whatsapp-link">
          <p className="text-[14px] text-foreground/75">
            <Trans>This uses WhatsApp without the official API. WhatsApp can ban the number.</Trans>
          </p>
          {link.qr ? <Qr text={link.qr} /> : null}
          <Button type="button" variant="ghost" size="sm" onClick={() => setLink(null)}>
            <Trans>Cancel</Trans>
          </Button>
        </div>
      ) : null}
      {error ? <p className="px-2.5 text-[13px] text-destructive">{error}</p> : null}
      {list.numbers.map((number) => (
        <NumberRow key={number.id} number={number} />
      ))}
    </div>
  );
}
