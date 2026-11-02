# Squad routing and the squad screen

## Intent

People who run Corvo for a team want to hand work to the whole team once and trust it to land with the
right specialists. Today a squad exists as a group chat, but the person must name the group or the bot
("send this to the design agent"). The Chief, the bot every account already has, should take a plain
request, pick the squad that fits, delegate, and say where it went and why. The person should then be
able to watch the squad work: what its bots say to each other and what each one is using.

## Decided with the owner

- The Chief coordinates every squad. A person talks to the Chief, not to each squad.
- A squad has a short purpose the Chief reads when choosing.
- The squad screen shows one lane per bot, side by side. Each lane shows the bot's state and what it is
  using. Between lanes, each handoff shows the message one bot sent the next. The Chief appears in a bar on
  top.
- A person can read what the bots say to each other, not only the final result.
- Who may route (decided): a bot with a new per-bot switch, `squadRouting`, on, in a run the person
  started, may hand off into any of the owner's groups in the same space. The switch is off for every bot
  and on for the Chief an account is given. The existing "Manage the bots it creates" switch is not used,
  because it defaults to on for every bot (migration `bot_fleet_management_default_on`) and would not
  narrow anything. The Chief is not made a member of every squad, because that spends a seat in each and
  needs manual setup for every new squad. The exception holds only when all three conditions are met: the
  switch is on, the person started the run, and the group belongs to the same owner and space. Approvals
  and Allow/Block lists apply to everything the squad does afterwards.

## Goals

- A request to the Chief reaches the right squad without the person naming it.
- The person sees where the Chief sent it and why, and is asked when two squads fit equally well.
- The squad screen shows live state, tool use and handoffs from real data.

## Non-goals

- No visual workflow builder, and no rules engine for routing. The Chief judges from purposes.
- No plan progress such as "1 of 3 parts" in the first version; the Chief bar shows its latest message.
- No routing across spaces, and no squads created automatically.
- No change to the handoff hop limit or to the rule that one bot owns each stage.

## Anti-goals

- The Chief must not act on sensitive things because it routed well. Approval modes and Allow/Block lists
  apply to every delegated action exactly as today.
- Text from outside (webhooks, channel messages) must not steer routing. The existing rule that such runs
  get no bot-management tools stays.

## Constraints

- Public repository, provider-neutral, no vendor in the core path.
- Migrations only add: a nullable `purpose` column on groups and a `squadRouting` boolean (default false)
  on bots. Nothing is dropped or renamed in the same deploy.
- Frontends render state; the server owns authorization and the routing tool's validation.
- Minimal copy. New visible words are quoted and justified in the PR.
- Web and the Electron app host the same screen. Mobile gets the purpose field and the Chief's routing
  (they live on the server) and an explicit follow-up for the lanes view.

## How it works (my calls unless marked)

1. **Purpose.** A squad (the existing group) gets an optional `purpose`, one line, about 300 characters,
   edited in the group's settings. It is added to the groups directory a bot sees and to `list_fleet`.
2. **Who may route.** Handoff today requires the sending bot to be a member of the target group, and groups
   hold 2 to 10 members. Making the Chief a member of every squad uses up a seat in each. Instead, a bot
   with `squadRouting` on (a new `bots` column, default false, set true when the Chief is created), in a
   run the person started, may hand off into any of the owner's groups in the same space (decided with
   the owner, see above). An existing Chief is switched on once in its Advanced settings. This is an
   authorization change, so its security tests come first in the plan.
3. **Say why.** `handoff_to_bot` takes an optional `reason`. It is stored on the handoff event and shown
   with the handoff.
4. **Ask when unsure.** The Chief's built-in instructions say to ask the person, using the existing
   question card, when two squads fit about equally, and not to guess.
5. **Squad screen.** A view of one squad from existing data: member run status, tool activity, and
   `group.handoff` events. Lane order follows the order bots first receive a handoff. A bot not yet
   involved shows as waiting. Clicking a lane opens that bot's messages in the squad thread.
6. **Replace the spike.** The scripted prototype is removed; nothing from it ships.

## Testing

- Deterministic and offline: with the scripted runtime, a request routes to the group whose purpose fits,
  the handoff carries the reason, a run the person did not start cannot route, and a bot without the switch
  cannot hand off outside its groups.
- Routing quality is natural-language judgment, so it is checked by an opt-in, provider-neutral LLM eval
  with a versioned rubric and reviewed examples, reported separately; a judge error counts as unqualified.
- Web test that opens the squad screen, so CI produces the screenshot linked in the PR.
- The migration is checked against the previous release's code (additive only).

## Left to the builder

Exact column length, where the purpose field sits in group settings, how tool activity is summarized per
lane, empty and error states, and keyboard and screen-reader behavior of the lanes.
