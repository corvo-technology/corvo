import { isRunWorking } from "@corvo/core";
import { BotAvatar, Button, Spinner } from "@corvo/ui-web";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { takeInitialBootstrap } from "../lib/bootstrap";
import { useSpaceQueries } from "../lib/query";
import { buildTeamRoster } from "../lib/team-roster";
import { WindowChrome } from "./WindowChrome";

const FAST_REFRESH_MS = 2_500;
const IDLE_REFRESH_MS = 15_000;

/** The whole company on one screen: each team, who is in it, and who is working right now. */
export function TeamPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const queries = useSpaceQueries();
  const bootstrap = useQuery({
    queryKey: queries.bootstrap.queryKey({ input: {} }),
    queryFn: () => takeInitialBootstrap(),
    refetchInterval: (query) =>
      query.state.data?.bots.some((bot) => isRunWorking(bot.status))
        ? FAST_REFRESH_MS
        : IDLE_REFRESH_MS,
  });
  const roster = useMemo(
    () => buildTeamRoster(bootstrap.data?.bots ?? [], bootstrap.data?.groups ?? []),
    [bootstrap.data],
  );
  const open = (path: string) => () => navigate(path);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background text-foreground">
      <div className="app-drag flex items-center gap-2 px-4 pt-3">
        <WindowChrome />
      </div>
      <h1 className="px-6 py-4 text-base font-medium">
        <Trans>Team</Trans>
      </h1>
      {bootstrap.isPending ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : null}
      <div className="flex flex-col gap-6 px-6 pb-8">
        {roster.teams.map(({ group, members, working }) => (
          <section key={group.id} data-testid={`team-${group.id}`} aria-label={group.name}>
            <Button
              variant="ghost"
              className="mb-2 h-auto justify-start gap-2 p-0 text-sm font-medium hover:bg-transparent"
              onClick={open(`/app/g/${group.id}/squad`)}
            >
              {group.name}
              {working > 0 ? (
                <span className="text-xs font-normal text-muted-foreground">
                  {t`${working} working`}
                </span>
              ) : null}
            </Button>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {members.map(({ bot, working: busy }) => (
                <li key={bot.id}>
                  <MemberCard
                    id={bot.id}
                    name={bot.name}
                    color={bot.color}
                    note={bot.preview}
                    busy={busy}
                    onOpen={open(`/app/${bot.id}`)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {roster.unassigned.length > 0 ? (
          <section data-testid="team-unassigned" aria-label={t`Not in a team`}>
            <h2 className="mb-2 text-sm font-medium">
              <Trans>Not in a team</Trans>
            </h2>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {roster.unassigned.map((bot) => (
                <li key={bot.id}>
                  <MemberCard
                    id={bot.id}
                    name={bot.name}
                    color={bot.color}
                    note={bot.preview}
                    busy={isRunWorking(bot.status)}
                    onOpen={open(`/app/${bot.id}`)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function MemberCard({
  id,
  name,
  color,
  note,
  busy,
  onOpen,
}: {
  id: string;
  name: string;
  color: string;
  note: string;
  busy: boolean;
  onOpen: () => void;
}) {
  return (
    <Button
      variant="ghost"
      data-testid={`member-${id}`}
      data-state={busy ? "working" : "idle"}
      className={`h-auto w-full items-start justify-start gap-3 rounded-xl border bg-card p-3 text-start ${
        busy ? "border-foreground/40" : "border-border"
      }`}
      onClick={onOpen}
    >
      <BotAvatar color={color} identity={id} size={32} status={busy ? "running" : undefined} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        {note ? (
          <span className="mt-0.5 line-clamp-2 block text-xs font-normal text-muted-foreground">
            {note}
          </span>
        ) : null}
      </span>
    </Button>
  );
}
