# Squad routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Chief picks the right squad from a one-line purpose, delegates, says why, and asks when two squads fit; a squad screen shows one lane per bot.

**Architecture:** Squads stay groups. A group gains `purpose`; a bot gains `squadRouting`. `handoffToGroupBot` accepts a non-member sender only when the bot has `squadRouting`, the run is owner-started, and the group is the same owner and space. The squad screen is derived in the web client from the group thread snapshot.

**Tech Stack:** TypeScript, Prisma/Postgres, oRPC, React (web, Electron), Expo (mobile), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-30-squad-routing-design.md`

## Global Constraints

- Migrations only add: nullable `purpose` on groups, `squadRouting` boolean default false on bots. Nothing dropped or renamed.
- The existing `fleetManagement` switch is not used for routing (it defaults to on for every bot).
- Routing authority needs all three: `squadRouting` on, owner-started run, group of the same owner and space.
- Text from webhooks or channel messages never steers routing; background triggers get no handoff tools (unchanged).
- Handoff hop limit and "one bot owns each stage" are unchanged.
- Tests are deterministic and offline. Routing quality is judged only by an opt-in, provider-neutral LLM eval with a versioned rubric, reported separately; a judge error is unqualified, not a pass.
- Minimal copy. Every new visible word is quoted in the PR with why it is needed.
- Web and Electron host the same screen; mobile gets the purpose field and the switch, and the lanes view is an explicit follow-up.
- Use `import type`; colors come from `@corvo/ui-tokens`; reuse `@corvo/ui-web` components.

## Review Focus

- A squad with no purpose: the directory line stays valid (no "null"), and the Chief still sees name and members.
- A purpose containing instruction-like text: it is escaped and labelled untrusted, like names today.
- An archived group or archived member: not listed, not targetable.
- A group deleted or archived between listing and handoff: the tool returns "group is no longer available", no task is queued.
- The same handoff retried with the same delivery key: one message, one task, no duplicate.

---

### Task 1: `squadRouting` switch

**Files:**
- Create: `packages/db/prisma/migrations/20261030120000_bot_squad_routing/migration.sql`
- Modify: every file `grep -rln fleetManagement apps packages --include='*.ts' --include='*.tsx' --include='*.prisma'` lists outside tests and `generated/` (schema, `packages/contracts/src/domain.ts`, `packages/db/src/repos.ts`, `apps/api/src/routes/bots.ts`, `packages/db/src/starter-team.ts`), mirroring each use
- Test: `packages/db/src/starter-team.test.ts`, `packages/contracts/src/index.test.ts`

**Interfaces:**
- Produces: `Bot.squadRouting: boolean` (contracts), writable through the bot update route, default `false`; the Chief created by `starter-team` has it `true`.

- [ ] **Step 1: Write the failing tests.** In `starter-team.test.ts`: `it("gives the Chief squad routing and no other starter bot")` asserts the Chief row has `squadRouting === true` and every other created bot `false`. In `index.test.ts`: `BotSchema.parse` of a bot without `squadRouting` fails, and with `false` passes.
- [ ] **Step 2: Run** `node_modules/.bin/vitest run packages/db/src/starter-team.test.ts packages/contracts/src/index.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Migration: `ALTER TABLE "bots" ADD COLUMN "squadRouting" BOOLEAN NOT NULL DEFAULT false;`. Add `squadRouting Boolean @default(false)` next to `fleetManagement` in the Bot model and regenerate the Prisma client. Mirror each `fleetManagement` use for the new field; `starter-team.ts` sets it only on the Chief.
- [ ] **Step 4: Run** the same command plus `(cd apps/web && ../../node_modules/.bin/tsc --noEmit -p .)`. Expected: PASS, no type errors.
- [ ] **Step 5: Commit** `git commit -m "Add a per-bot squad routing switch"`.

### Task 2: Group `purpose`

**Files:**
- Create: `packages/db/prisma/migrations/20261030120001_group_purpose/migration.sql`
- Modify: `packages/db/prisma/schema.prisma` (`ChatGroup`), `packages/contracts/src/domain.ts` (`GroupSchema`, `SpaceGroupSchema`, the group update input), `packages/db/src/groups.ts` (`mapGroup`, `createGroup`, `updateGroup`), `apps/api/src/routes/bots.ts:597`
- Test: `packages/db/src/groups.postgres.test.ts` (find the existing group repo test with `ls packages/db/src | grep groups`)

**Interfaces:**
- Produces: `GROUP_PURPOSE_MAX_LENGTH = 300` exported from `@corvo/contracts`; `Group.purpose: string | null`; `updateGroup(actor, { groupId, purpose?: string | null })`, where an empty or whitespace string stores `null`.

- [ ] **Step 1: Write the failing tests:** `it("stores a trimmed purpose and clears it with an empty string")`; `it("rejects a purpose over GROUP_PURPOSE_MAX_LENGTH")`.
- [ ] **Step 2: Run** the group test file. Expected: FAIL.
- [ ] **Step 3: Implement.** Migration `ALTER TABLE "chat_groups" ADD COLUMN "purpose" TEXT;`. Single line, trimmed, validated in contracts, and mapped in `mapGroup`.
- [ ] **Step 4: Run** the group tests and the web `tsc`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Give a group a one-line purpose"`.

### Task 3: Handoff authority and `reason` (security first)

**Files:**
- Modify: `packages/adapters/src/group-handoff.ts` (`handoffToGroupBot`), `packages/adapters/src/run-tools-messaging.ts:173`, `packages/adapters/src/builtin-tools.ts` (`handoff_to_bot` schema), `packages/adapters/src/run-context.ts` (`RunContext`), `packages/adapters/src/executor.ts` (set it near `ownerStartedRun`, line ~929), `packages/contracts/src/events.ts:286` (handoff block)
- Test: create `packages/adapters/src/group-handoff-routing.test.ts`, modeled on the nearest existing handoff test (`grep -ln handoffToGroupBot packages/adapters/src/*.test.ts`)

**Interfaces:**
- Consumes: `Bot.squadRouting` (Task 1).
- Produces: `handoffToGroupBot(deps, run, groupId, input: { bot_id?: string; confirm_name?: string; message: string; reason?: string; deliveryKey?: string }, authority: { squadRouting: boolean; ownerStarted: boolean })`; `RunContext.ownerStarted: boolean`; `HANDOFF_REASON_MAX_LENGTH = 300` in contracts; the handoff `MessageBlock` and the `group.handoff` event payload gain optional `reason`.

- [ ] **Step 1: Write the failing tests** (names, each asserting the result and that no task or run was created on refusal):
  - `a bot without squadRouting cannot hand off to a group it is not in` → error `"source bot is no longer a group member"`.
  - `a squadRouting bot in an owner-started run hands off into a group it is not in` → `ok: true`, target `botId`, a `group.handoff` event in the group's thread.
  - `a squadRouting bot in a run the owner did not start is refused`.
  - `a squadRouting bot cannot reach another owner's or another space's group` → `"group is no longer available"`.
  - `a squadRouting bot inside a group still cannot hand off to a different group` → `"group handoffs must stay in the current group"`.
  - `the reason is stored on the block and the event, and one over HANDOFF_REASON_MAX_LENGTH is refused`.
  - `a retried handoff with the same deliveryKey creates one message and one task`.
  - `an archived group or archived target bot is refused`.
- [ ] **Step 2: Run** `node_modules/.bin/vitest run packages/adapters/src/group-handoff-routing.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Relax only the member check: the sender may be a non-member when `authority.squadRouting && authority.ownerStarted`; the group lookup still filters by `userId` and `spaceId` and `archivedAt: null`. Add `reason` to the tool's input schema, the block and the payload. Pass `authority` from the handler using `ctx.bot.squadRouting` and `ctx.ownerStarted`. Make `authority` a required parameter so any other caller fails typecheck.
- [ ] **Step 4: Run** the new tests and the existing handoff tests (`node_modules/.bin/vitest run packages/adapters/src/group-handoff`). Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Let a squad-routing bot hand off to any of the owner's groups"`.

### Task 4: Directory, `list_fleet` and routing guidance

**Files:**
- Modify: `packages/core/src/bot-messages.ts` (`renderBotGroupDirectory`), `packages/adapters/src/group-handoff.ts` (`loadBotGroupDirectory`), `packages/adapters/src/executor.ts:1276`, `packages/adapters/src/fleet-tools.ts` (`listFleet` groups)
- Test: `packages/core/src/bot-messages.test.ts`, `packages/adapters/src/group-handoff-routing.test.ts`

**Interfaces:**
- Consumes: `Group.purpose` (Task 2), `Bot.squadRouting` (Task 1), `RunContext.ownerStarted` (Task 3).
- Produces: `renderBotGroupDirectory(groups: { id: string; name: string; purpose?: string | null; members: readonly BotAddress[] }[], options?: { routing?: boolean }): string | undefined`; `loadBotGroupDirectory(prisma, actor, options?: { allGroups?: boolean })`; `listFleet` group entries include `purpose`.

- [ ] **Step 1: Write the failing tests:** a group with a purpose renders it inside its `<bot_groups>` line, escaped through `escapeDirectoryField`; a group without one renders no "null"; with `routing: true` the block adds guidance to choose by purpose, include a `reason`, and ask with `ask_user` when two fit equally (assert only that the guidance block is present, not its wording); `loadBotGroupDirectory` with `allGroups: true` lists groups of the same owner and space the bot is not in, never archived ones, never another owner's; without it, only member groups.
- [ ] **Step 2: Run** both test files. Expected: FAIL.
- [ ] **Step 3: Implement.** The executor passes `{ allGroups: bot.squadRouting && ownerStartedRun }`. `take: 40` stays.
- [ ] **Step 4: Run** both files and `list_fleet` tests (`node_modules/.bin/vitest run packages/adapters/src/fleet-tools`). Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Show squad purposes to the Chief and guide how it routes"`.

### Task 5: Settings UI and the reason on a handoff

**Files:**
- Modify: `apps/web/src/pages/GroupPanel.tsx` (`GroupSettings`), `apps/web/src/pages/shell/side-panel.tsx:173`, `apps/web/src/pages/shell/bot-panel.tsx` (Advanced switch, beside `fleetManagement`), `apps/mobile/app/group-settings.tsx`, `apps/mobile/app/bot-settings.tsx`, `apps/web/src/pages/shell/message-view.tsx` (handoff block), locale catalogs via `apps/web/node_modules/.bin/lingui extract --clean`
- Test: `apps/web/src/pages/GroupPanel.test.tsx`, `apps/web/src/pages/shell/bot-panel.test.tsx`, `apps/web/src/pages/shell/message-view-delegation.test.tsx`

**Interfaces:**
- Consumes: `Group.purpose`, `Bot.squadRouting`, the handoff block `reason`.

- [ ] **Step 1: Write the failing tests:** `GroupSettings` saves `purpose` through `onSave({ purpose })` and shows its current value; the Advanced switch calls the bot update with `squadRouting`; a handoff block with a `reason` shows it beside the handoff text and one without shows nothing extra.
- [ ] **Step 2: Run** the three web test files. Expected: FAIL.
- [ ] **Step 3: Implement** with the existing field and switch components; mobile uses native controls per `AGENTS.md`. New visible copy is limited to the field label and the switch name; quote both in the PR.
- [ ] **Step 4: Run** the three files and `(cd apps/web && ../../node_modules/.bin/tsc --noEmit -p .)`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "Edit a squad's purpose and show why work was handed off"`.

### Task 6: Squad screen

**Files:**
- Create: `apps/web/src/lib/squad-lanes.ts`, `apps/web/src/lib/squad-lanes.test.ts`, `apps/web/src/pages/SquadPage.tsx`, `apps/web/src/pages/SquadPage.test.tsx`
- Modify: `apps/web/src/App.tsx` (route `/app/g/:groupId/squad`, before `/app/:botId`), the group chat header (`apps/web/src/pages/shell/chat-header.tsx`, an icon button with an accessible name)
- Delete: the throwaway spike on branch `squad-spike` (`apps/web/src/pages/SquadPreview.tsx` and its route); nothing from it ships

**Interfaces:**
- Produces: `buildSquadLanes(input: { members: { botId: string; name: string; color: string; status: string }[]; messages: ThreadMessage[] }): SquadLane[]` with `SquadLane = { botId: string; name: string; color: string; state: "waiting" | "working" | "done"; activity: string[]; handoffIn: { fromBotId: string; text: string; reason?: string } | null }`.

- [ ] **Step 1: Write the failing tests** for `buildSquadLanes`: lanes are ordered by the order bots first receive a handoff, bots not yet involved come last as `waiting`; a member with an active run is `working`; a member that received a handoff, has no active run and has posted since is `done`; `handoffIn` carries the latest handoff's text and reason; a squad with one active member returns one lane. `SquadPage.test.tsx` opens `/app/g/<id>/squad` with a fixed snapshot and asserts the lanes and the Chief bar (its latest message); this test also produces the CI screenshot linked in the PR.
- [ ] **Step 2: Run** `node_modules/.bin/vitest run apps/web/src/lib/squad-lanes.test.ts apps/web/src/pages/SquadPage.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the pure function, then the page from the group thread snapshot; `activity` reuses the step list the tool-activity cards use (`docs/tool-activity.md`). Lanes stack on narrow screens; clicking a lane opens that bot's messages in the squad thread.
- [ ] **Step 4: Run** both files and web `tsc`. Expected: PASS. Then look at the screen in the dev app (`pnpm`-less: `apps/web/node_modules/.bin/vite --host 127.0.0.1 --port 5173 --strictPort` under Node 24).
- [ ] **Step 5: Commit** `git commit -m "Show a squad as one lane per bot"`.

### Task 7: Routing eval and docs

**Files:**
- Create: `docs/evals/squad-routing.md` (versioned rubric and reviewed examples), an opt-in eval case under `packages/testkit/src/evals/` modeled on the existing ones (`ls packages/testkit/src/evals`)
- Modify: `docs/fleet-management.md` (it says the switch is off for new bots; the default is on since `20261022200000`), a short "Squads" section in the same docs folder

- [ ] **Step 1: Write the eval cases:** requests with clear, ambiguous and no-fit squads; expected observable effect is the target group id, or an `ask_user` call for the ambiguous case; the judge scores only the stated reason.
- [ ] **Step 2: Run it offline** with the scripted runtime and confirm the observable-effect assertions pass; the judge step stays opt-in and reports its cost separately.
- [ ] **Step 3: Fix the stale fleet doc and document the purpose field, the Chief's switch and the lanes screen.**
- [ ] **Step 4: Commit** `git commit -m "Add the squad routing eval and docs"`.

## Self-review

- Spec coverage: purpose (T2, T5), who may route (T1, T3), say why (T3, T5), ask when unsure (T4), squad screen (T6), replace spike (T6), testing and eval (T3, T4, T7), mobile scope (T5), migrations (T1, T2).
- The Chief bar shows its latest message only; plan progress stays out, as in the spec's non-goals.
- Names are consistent across tasks: `squadRouting`, `purpose`, `GROUP_PURPOSE_MAX_LENGTH`, `HANDOFF_REASON_MAX_LENGTH`, `authority`, `ownerStarted`, `buildSquadLanes`.
