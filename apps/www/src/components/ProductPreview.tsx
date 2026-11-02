import { useEffect, useRef, useState } from "react";
import type { LaunchAgent, LaunchCopy, PreviewMessage } from "../i18n/launch";
import { Pet } from "./Chick";
import "../styles/preview.css";

type Copy = LaunchCopy["preview"];
type Decision = "pending" | "approved" | "denied";

const RAIL = ["agents", "routines", "workflows", "more"] as const;

function agentOf(copy: Copy, name: string): LaunchAgent {
  return copy.agents.find((agent) => agent.name === name) ?? copy.agents[0]!;
}

function RailIcon({ kind }: { kind: (typeof RAIL)[number] | "store" }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (kind === "agents")
    return (
      <svg {...common}>
        <rect x="5" y="8" width="14" height="11" rx="3" />
        <path d="M12 8V5M9 13h.01M15 13h.01" />
      </svg>
    );
  if (kind === "routines")
    return (
      <svg {...common}>
        <rect x="4" y="5" width="13" height="14" rx="2" />
        <path d="M4 10h13M8 3v4M13 3v4" />
        <circle cx="18" cy="17" r="3.5" />
        <path d="M18 15.5V17l1 .8" />
      </svg>
    );
  if (kind === "workflows")
    return (
      <svg {...common}>
        <rect x="4" y="4" width="6" height="6" rx="1.5" />
        <rect x="14" y="14" width="6" height="6" rx="1.5" />
        <path d="M7 10v4a2 2 0 0 0 2 2h5" />
      </svg>
    );
  if (kind === "more")
    return (
      <svg {...common}>
        <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth="2.4" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M4 10l1.5-5h13L20 10M5 10v9h14v-9M9 19v-5h6v5" />
    </svg>
  );
}

function Steps({ message, open }: { message: Extract<PreviewMessage, { kind: "agent" }>; open: boolean }) {
  if (!message.steps) return null;
  return (
    <details className="pv-steps" open={open}>
      <summary>
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {message.steps.count}
      </summary>
      <ul>
        {message.steps.items.map((step) => (
          <li key={step.verb + step.detail}>
            <span className="pv-check" aria-hidden="true">
              <svg viewBox="0 0 12 12" width="9" height="9">
                <path d="M2.5 6.3l2.2 2.2 4.8-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="pv-step__verb">{step.verb}</span>
            <span className="pv-step__detail">{step.detail}</span>
            <span className="pv-step__took">{step.took}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * The product, as it looks: the rail, the channels and agents, a channel with an agent waiting on
 * your yes. Every agent is alive: pointed at, they hop; working, their eyes read; done, they smile.
 */
export function ProductPreview({ copy }: { copy: Copy }) {
  const [activeId, setActiveId] = useState(copy.conversations[0]!.id);
  const [decision, setDecision] = useState<Decision>("pending");
  const [working, setWorking] = useState<string | null>(null);
  const [happy, setHappy] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const thread = useRef<HTMLDivElement>(null);
  const active = copy.conversations.find((item) => item.id === activeId) ?? copy.conversations[0]!;
  const channels = copy.conversations.filter((item) => item.kind === "channel");
  const dms = copy.conversations.filter((item) => item.kind === "dm");

  // The newest message is the one in view, as in the app.
  const finishedKey = decision !== "pending" && working === null;
  useEffect(() => {
    const element = thread.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [activeId, finishedKey]);

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    },
    [],
  );

  const decide = (next: Exclude<Decision, "pending">) => {
    if (decision !== "pending") return;
    setDecision(next);
    setWorking("Bento");
    timers.current.push(
      window.setTimeout(() => {
        setWorking(null);
        if (next === "approved") {
          setHappy("Bento");
          timers.current.push(window.setTimeout(() => setHappy(null), 1600));
        }
      }, 1500),
    );
  };

  const moodOf = (name: string) => (working === name ? "working" : happy === name ? "happy" : "idle");
  const finished = decision !== "pending" && working === null;
  const reply = decision === "approved" ? copy.approvedReply : copy.deniedReply;
  const chief = copy.agents[0]!;

  return (
    <div className="pv" data-testid="product-preview">
      <nav className="pv-rail" aria-label={copy.window}>
        {RAIL.map((kind) => (
          <span key={kind} className="pv-rail__item" data-active={kind === "agents" ? "" : undefined}>
            <RailIcon kind={kind} />
            {copy.rail[kind]}
          </span>
        ))}
        <span className="pv-rail__item pv-rail__item--end">
          <RailIcon kind="store" />
          {copy.rail.store}
        </span>
      </nav>

      <aside className="pv-side">
        <p className="pv-workspace">{copy.workspace}</p>
        <div className="pv-chief">
          <Pet hue={chief.hue} size={40} interactive />
          <div>
            <p className="pv-chief__name">{copy.chief}</p>
            <p className="pv-chief__title">{copy.chiefTitle}</p>
            <p className="pv-chief__line">{copy.chiefLine}</p>
          </div>
        </div>
        <p className="pv-label">{copy.channels}</p>
        <ul className="pv-list">
          {channels.map((channel) => (
            <li key={channel.id}>
              <button type="button" className="pv-row pv-row--channel" aria-current={channel.id === active.id ? "true" : undefined} onClick={() => setActiveId(channel.id)}>
                <span aria-hidden="true" className="pv-hash">#</span>
                {channel.name}
              </button>
            </li>
          ))}
        </ul>
        <p className="pv-label">{copy.directMessages}</p>
        <ul className="pv-list">
          {dms.map((dm) => {
            const agent = agentOf(copy, dm.name);
            return (
              <li key={dm.id}>
                <button type="button" className="pv-row" aria-current={dm.id === active.id ? "true" : undefined} onClick={() => setActiveId(dm.id)}>
                  <Pet hue={agent.hue} size={30} mood={moodOf(agent.name)} />
                  {dm.name}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="pv-main" aria-label={active.name}>
        <div className="pv-tabs" role="tablist">
          {copy.conversations.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={item.id === active.id} onClick={() => setActiveId(item.id)}>
              {item.kind === "channel" ? "# " : ""}
              {item.name}
            </button>
          ))}
        </div>
        <header className="pv-head">
          {active.kind === "channel" ? (
            <>
              <h3>
                <span aria-hidden="true">#</span> {active.name}
              </h3>
              {active.purpose ? <p>{active.purpose}</p> : null}
              <span className="pv-faces">
                {active.members.map((name) => (
                  <Pet key={name} hue={agentOf(copy, name).hue} size={24} mood={moodOf(name)} />
                ))}
                <span className="pv-count">
                  {active.members.length} {copy.agentsCount}
                </span>
              </span>
            </>
          ) : (
            <>
              <Pet hue={agentOf(copy, active.name).hue} size={26} mood={moodOf(active.name)} />
              <h3>{active.name}</h3>
              <p>{agentOf(copy, active.name).role}</p>
            </>
          )}
        </header>

        <div className="pv-thread" key={active.id} ref={thread}>
          {active.messages.map((message, index) => {
            if (message.kind === "you") {
              return (
                <div key={index} className="pv-you">
                  <p>{message.text}</p>
                </div>
              );
            }
            const agent = agentOf(copy, message.agent);
            return (
              <article key={index} className="pv-msg">
                <Pet hue={agent.hue} size={36} mood={moodOf(agent.name)} interactive />
                <div className="pv-msg__body">
                  <p className="pv-msg__who">
                    <strong>{agent.name}</strong>
                    <time>{message.time}</time>
                    {working === agent.name ? <em>{copy.working}</em> : null}
                  </p>
                  <Steps message={message} open={false} />
                  {message.text.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  {message.approval ? (
                    <div className="pv-approval" data-decision={decision}>
                      <p className="pv-approval__flag">
                        {decision === "pending" ? copy.waiting : decision === "approved" ? copy.approved : copy.denied}
                      </p>
                      <p className="pv-approval__title">{copy.approvalTitle}</p>
                      <p className="pv-approval__body">{copy.approvalBody}</p>
                      <code>{copy.approvalCall}</code>
                      {decision === "pending" ? (
                        <div className="pv-approval__actions">
                          <button type="button" className="pv-btn pv-btn--solid" onClick={() => decide("approved")}>
                            {copy.approve}
                          </button>
                          <button type="button" className="pv-btn" onClick={() => decide("denied")}>
                            {copy.deny}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
          {active.id === copy.conversations[0]!.id && finished ? (
            <article className="pv-msg">
              <Pet hue={agentOf(copy, "Bento").hue} size={36} mood={moodOf("Bento")} interactive />
              <div className="pv-msg__body">
                <p className="pv-msg__who">
                  <strong>Bento</strong>
                </p>
                {reply.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </article>
          ) : null}
        </div>

        <div className="pv-composer">
          <p>
            {copy.composer} {active.kind === "channel" ? `#${active.name}` : active.name}
          </p>
          <small>{copy.composerHint}</small>
        </div>
      </section>
    </div>
  );
}
