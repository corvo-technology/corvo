import type { SpaceBot, Ticket } from "@corvo/contracts";
import { BotAvatar, Button } from "@corvo/ui-web";
import { useLingui } from "@lingui/react/macro";
import type { ReactNode } from "react";
import { formatRelativeTime } from "../lib/relative-time";
import { rosterAttentionLabel, rosterWorkStatusLabel } from "../lib/roster-status";
import type { Team, TeamMember } from "../lib/team-roster";
import { botNeedsYou } from "../lib/team-roster";

export type TeamBoardRoster = {
  chief: SpaceBot | undefined;
  teams: Team[];
  unassigned: SpaceBot[];
};

/**
 * The whole company: the Chief that leads it, each team as a panel with its purpose, who is in it
 * and what each one is doing, and the agents that belong to no team yet. It is a picture of the
 * moment: what is shown is what is in `roster`.
 */
export function TeamBoard({
  roster,
  tickets,
  onOpen,
}: {
  roster: TeamBoardRoster;
  /** What each agent is working on, by agent id. */
  tickets?: ReadonlyMap<string, readonly Ticket[]>;
  onOpen: (path: string) => void;
}) {
  const { t } = useLingui();
  const asMember = (bot: SpaceBot): TeamMember => ({
    bot,
    working: rosterWorkStatusLabel(bot.status) !== null,
    needsYou: botNeedsYou(bot.status),
  });
  return (
    <div className="flex flex-col gap-4">
      {roster.chief ? (
        <MemberButton
          member={asMember(roster.chief)}
          lead
          testId="team-chief"
          onOpen={() => onOpen(`/app/${roster.chief?.id}`)}
        />
      ) : null}
      {/* Columns, not rows, so a short team fills the space under another and none leaves a gap. */}
      <ul className="columns-[320px] gap-4">
        {roster.teams.map((team) => (
          <li key={team.group.id} className="mb-4 break-inside-avoid">
            <Panel
              testId={`team-${team.group.id}`}
              name={team.group.name}
              purpose={team.group.purpose}
              count={team.members.length}
              working={team.working}
              onOpenTeam={() => onOpen(`/app/g/${team.group.id}/squad`)}
            >
              {team.members.map((member) => (
                <div key={member.bot.id}>
                  <MemberButton
                    member={member}
                    testId={`member-${member.bot.id}`}
                    onOpen={() => onOpen(`/app/${member.bot.id}`)}
                  />
                  <MemberTickets
                    tickets={tickets?.get(member.bot.id)}
                    botId={member.bot.id}
                    onOpen={onOpen}
                  />
                </div>
              ))}
            </Panel>
          </li>
        ))}
        {roster.unassigned.length > 0 ? (
          <li className="mb-4 break-inside-avoid">
            <Panel
              testId="team-unassigned"
              name={t`Not in a team`}
              count={roster.unassigned.length}
              working={roster.unassigned.filter((bot) => asMember(bot).working).length}
            >
              {roster.unassigned.map((bot) => (
                <div key={bot.id}>
                  <MemberButton
                    member={asMember(bot)}
                    testId={`member-${bot.id}`}
                    onOpen={() => onOpen(`/app/${bot.id}`)}
                  />
                  <MemberTickets tickets={tickets?.get(bot.id)} botId={bot.id} onOpen={onOpen} />
                </div>
              ))}
            </Panel>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function Panel({
  testId,
  name,
  purpose,
  count,
  working,
  onOpenTeam,
  children,
}: {
  testId: string;
  name: string;
  purpose?: string | null;
  count: number;
  working: number;
  onOpenTeam?: () => void;
  children: ReactNode;
}) {
  const { t } = useLingui();
  const title = (
    <>
      <span className="block truncate text-[15px] font-semibold text-foreground" dir="auto">
        {name}
      </span>
      {purpose ? (
        <span
          dir="auto"
          className="mt-0.5 line-clamp-2 block text-[13px] font-normal text-muted-foreground"
        >
          {purpose}
        </span>
      ) : null}
      <span className="mt-1 flex items-center gap-2 text-xs font-normal text-muted-foreground">
        {count > 1 ? <span>{t`${count} agents`}</span> : null}
        {working > 0 ? (
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="corvo-presence-dot size-1.5 shrink-0 rounded-full bg-status-working"
            />
            {t`${working} working`}
          </span>
        ) : null}
      </span>
    </>
  );
  return (
    <section
      data-testid={testId}
      aria-label={name}
      className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-2"
    >
      {onOpenTeam ? (
        <Button
          variant="ghost"
          className="h-auto w-full flex-col items-start justify-start rounded-xl px-2 py-2 text-start whitespace-normal"
          onClick={onOpenTeam}
        >
          {title}
        </Button>
      ) : (
        <div className="px-2 py-2">{title}</div>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  );
}

/** What an agent is doing, in one short line: its state when it has one, else when it last was. */
function stateOf(member: TeamMember): { text: string; tone: "working" | "attention" | "idle" } {
  const { bot } = member;
  const attention = rosterAttentionLabel(bot.status);
  if (attention) return { text: attention, tone: "attention" };
  const work = rosterWorkStatusLabel(bot.status);
  if (work) return { text: work, tone: "working" };
  return { text: formatRelativeTime(bot.updatedAt), tone: "idle" };
}

function MemberButton({
  member,
  lead = false,
  testId,
  onOpen,
}: {
  member: TeamMember;
  lead?: boolean;
  testId: string;
  onOpen: () => void;
}) {
  const { bot } = member;
  const state = stateOf(member);
  return (
    <Button
      variant="ghost"
      data-testid={testId}
      data-state={member.needsYou ? "needs-you" : member.working ? "working" : "idle"}
      className={
        lead
          ? "h-auto w-full justify-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-start"
          : "h-auto w-full justify-start gap-3 rounded-xl px-2 py-2 text-start"
      }
      onClick={onOpen}
    >
      <BotAvatar color={bot.color} identity={bot.id} size={lead ? 40 : 30} status={bot.status} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[14px] font-medium text-foreground" dir="auto">
            {bot.name}
          </span>
          {state.text ? (
            <span
              className={`shrink-0 text-xs font-normal ${
                state.tone === "working"
                  ? "text-shimmer"
                  : state.tone === "attention"
                    ? bot.status === "failed"
                      ? "text-destructive"
                      : "text-warning"
                    : "text-muted-foreground"
              }`}
            >
              {state.text}
            </span>
          ) : null}
        </span>
        {bot.title ? (
          <span
            dir="auto"
            className="mt-0.5 block truncate text-[13px] font-normal text-muted-foreground"
          >
            {bot.title}
          </span>
        ) : null}
      </span>
    </Button>
  );
}

/** The tickets an agent has open, each one opening on the board. Nothing for an agent with none. */
function MemberTickets({
  tickets,
  botId,
  onOpen,
}: {
  tickets: readonly Ticket[] | undefined;
  botId: string;
  onOpen: (path: string) => void;
}) {
  if (!tickets?.length) return null;
  return (
    <ul data-testid={`member-tickets-${botId}`} className="ms-11 flex flex-col pb-1">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-2 rounded-lg px-2 py-1 text-start text-xs font-normal text-muted-foreground"
            onClick={() => onOpen(`/app/board?ticket=${ticket.ref}`)}
          >
            <span className="shrink-0">{ticket.ref}</span>
            <span className="truncate" dir="auto">
              {ticket.title}
            </span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
