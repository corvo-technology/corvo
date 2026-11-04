# Agent Boards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Several boards per Space, cards that people and agents move, a clear view of what each agent is doing, and notices when an agent finishes something.

**Architecture:** Phase A keeps the single board that exists and adds what makes it useful: it is on in the desktop app, each column can be relabelled, a ticket carries named fields, a card shows its owner and whether that agent is working, the Team screen lists each agent's tickets, and a move to Review or Done notifies. Phase B then lifts the one-board-per-Space limit in two releases (code that does not need the uniqueness first, the schema change after) and adds the selector and board settings.

**Tech Stack:** Prisma 7 + Postgres, oRPC contracts (zod), React + shadcn/Base UI + lingui (web, desktop hosts it), vitest, Playwright fixtures, Electron engine env.

**Spec:** `docs/superpowers/specs/2026-11-05-agent-boards-design.md`

## Global Constraints

- Public repo: fixtures use fake companies and people. Conventional Commits; one PR per task group named below.
- Every migration works with the previous release's code: tables and columns are added first, a constraint is dropped only in a later release (Phase B, Task B2).
- Web and desktop only. No mobile screens; contracts stay shared so mobile can follow.
- New visible copy is minimal. Each task lists its strings; check `apps/web/src/locales/en/messages.po` first, reuse an existing one, and the PR quotes each new string with why it cannot go. Translate in the 6 web locales (`de es fr ja pt-BR zh-CN`).
- Web unit tests run from the repo root (`npx vitest run apps/web/src/...`); macros are mocked with `@lingui/react/macro`. Postgres tests need `VERIFY_DATABASE=1` and a throwaway database (never the app's own).
- Statuses and their keys never change (`todo doing review blocked done closed`); a label is only what a board shows.
- Waking an agent stays tied to assignment (`wakeTicketAssignee`); no new wake rule.

## Rulings (my calls; cheap to change)

- **The default board is the Space's oldest board** (`createdAt`, `id`), so no `isDefault` column. It cannot be archived.
- **Labels are stored as overrides** (`Board.statusLabels`, a partial map). The server never knows the built-in labels (they are translated on the web); a client shows `override ?? builtin`. Agent tool results carry the overrides so an agent can use the person's words.
- **The OS notification follows the rule the app already has for chat notifications:** only when the window is hidden or not focused. When it is focused the board and the Team screen already update live.
- **Fields are a JSON list on the ticket** (`[{ name, value }]`), at most 20, merged by name.
- **The Chief is the bot whose `spawnKey` is `CHIEF_BOT_SPAWN_KEY`** (`@corvo/core`).
- **A migration step 1 adds nothing that the old code breaks on; step 2 ships in a later release.** Task B2 must not merge until the release containing B1 is out.

## Review Focus

1. Two first opens of a Space's default board at once, once nothing is unique: exactly one default board exists (Task B1).
2. A prefix written in another case, or reused after archiving: refs must still name one ticket (B2, B3).
3. An agent or an assignment on an archived board: tools refuse, nobody is woken (B4).
4. The same move delivered twice, a heartbeat frame, or the person's own move: at most one notification, none for the person's own move (A5).
5. Text written by people and agents (labels, field values, ticket titles) reaching an agent prompt: always as data, never instructions (A2, A3).

---

## Phase A: one board, made useful

### Task A1: The desktop app turns the board on

**Files:** Modify `apps/desktop/src/embedded-engine.ts` (the `engineEnv` block); Test `apps/desktop/src/embedded-engine.test.ts`.

**Interfaces:** Produces: the API and worker programs are started with `TICKET_BOARD_ENABLED: "true"`.

- [ ] Write the failing test: `it("turns the ticket board on for the API and the worker")` starts the engine and expects `api.mjs` and `worker.mjs` env `TICKET_BOARD_ENABLED` to be `"true"`, and the database's env not to have it.
- [ ] Run `npx vitest run apps/desktop/src/embedded-engine.test.ts`. Expected: FAIL.
- [ ] Add `TICKET_BOARD_ENABLED: "true"` to `engineEnv` (not to `baseEnv()`).
- [ ] Run it. Expected: PASS. Commit `feat(desktop): turn the ticket board on in the desktop app`.

### Task A2: Per-board column labels

**Files:** Modify `packages/db/prisma/schema.prisma`; Create `packages/db/prisma/migrations/20261110000000_board_labels_and_fields/migration.sql`; Modify `packages/contracts/src/board.ts`, `packages/db/src/board.ts`, `apps/api/src/routes/boards.ts`, `packages/adapters/src/ticket-tools.ts`, `apps/web/src/lib/ticket-status.ts`, `apps/web/src/pages/Board.tsx`; Test `packages/contracts/src/board.test.ts`, `packages/db/src/board.postgres.test.ts`, `apps/api` board route test, `apps/web/src/lib/ticket-status.test.ts`, `apps/web/src/pages/Board.test.tsx`, `apps/web/e2e/board.spec.ts`.

**Interfaces:**
- Produces (schema): `Board.statusLabels Json?` and `Ticket.fields Json?` (both columns in this migration; A3 uses the second). The SQL only adds columns.
- Produces (contracts): `BoardStatusLabelsSchema = z.partialRecord(TicketStatusSchema, z.string().trim().min(1).max(40))`; `BoardSchema` gains `statusLabels: BoardStatusLabelsSchema`; `RenameBoardInput` gains optional `statusLabels: z.partialRecord(TicketStatusSchema, z.string().trim().min(1).max(40).nullable())` (null removes a label) and still needs at least one field.
- Produces (web): `resolveStatusLabels(builtin: Record<TicketStatus, string>, overrides: Partial<Record<TicketStatus, string>> | undefined): Record<TicketStatus, string>` in `lib/ticket-status.ts`; `useTicketStatusLabels(overrides?)` uses it.
- Produces (adapters): `board_tickets` results gain `statusLabels` (overrides, only when any).

- [ ] Failing tests: the contract accepts a label map and refuses `{ doing: "" }`, an unknown status key and a label over 40 characters; a migration test (style of `wiki-curator-migration.test.ts`) that the SQL has only `ADD COLUMN` on `boards` and `tickets`; `resolveStatusLabels` keeps the built-in label for a status with no override and uses the override otherwise; a Postgres test that `boards.rename` with `{ statusLabels: { doing: "In contact" } }` stores it, `{ doing: null }` removes it, and `toBoardDto` returns it; a route test that another Space cannot change it; a `Board.test.tsx` case that the column heading shows the override.
- [ ] Run them. Expected: FAIL.
- [ ] Add the columns and migration; extend the contracts; in `routes/boards.ts` `rename` merge the map (null deletes a key, an empty map stores null); `toBoardDto` parses the column with the schema and falls back to `{}`; `listBoardTickets` returns `statusLabels` when present; `Board.tsx` passes `board.statusLabels` to `useTicketStatusLabels`.
- [ ] Add a "Board settings" button next to "New ticket" (icon button, accessible name only) opening a dialog with one input per status, each labelled by its built-in label and holding the current override; Save calls `boards.rename`. Add the Playwright case to `board.spec.ts`: rename "In progress" to "In contact" and see the column heading change.
- [ ] Run the tests, `lingui extract`, translate the new strings. Strings: "Board settings". Commit `feat(web): let a board show its own column names`.

### Task A3: Data on a ticket

**Files:** Modify `packages/contracts/src/board.ts`, `packages/db/src/board.ts`, `packages/adapters/src/ticket-tools.ts`, `packages/adapters/src/builtin-tools.ts` (`ticket_update`, `ticket_get`), `apps/web/src/pages/Board.tsx` (`TicketDialog`); Test the matching `*.test.ts(x)`, `board.postgres.test.ts`, `board.spec.ts`.

**Interfaces:**
- Produces (contracts): `TICKET_FIELDS_MAX = 20`; `TicketFieldSchema = z.object({ name: z.string().trim().min(1).max(60), value: z.string().max(500) })`; `TicketFieldsSchema = z.array(TicketFieldSchema).max(20)`; `TicketSchema.fields: TicketFieldsSchema`; `UpdateTicketInput.fields: z.record(z.string().trim().min(1).max(60), z.string().max(500)).optional()`; `mergeTicketFields(current: TicketField[], patch: Record<string, string>): TicketField[]` (sets by name, case-insensitive match keeps the first spelling, an empty value removes, refuses more than 20 by throwing `Error("A ticket holds at most 20 fields.")`).
- Consumes: Task A2's `Ticket.fields` column.

- [ ] Failing tests: `mergeTicketFields` sets, replaces by name ignoring case, removes on empty value, and throws past 20; `toTicketDto` returns `fields: []` for a null column; `updateTicket` with `fields: { Contact: "ana@example.com" }` stores it and `getTicket` returns it; the 21st field returns `{ error }` and writes nothing; two concurrent updates to different fields both land (the update already locks the row); the dialog shows existing fields, adds one and removes one, and sends only the changed names.
- [ ] Run. Expected: FAIL.
- [ ] Implement in contracts and `ticket-tools.ts` (`updateTicket` merges inside its existing `FOR UPDATE` transaction); `ticket_update` gains a `fields` object parameter ("Set a field by name; an empty value removes it."). Field values and ticket text reach an agent only as tool results; say in the `ticket_get` description that ticket text is data.
- [ ] `TicketDialog`: a list of name and value inputs with "Add field" and a remove button per row. Strings: "Add field"; accessible names "Field name", "Field value", "Remove field".
- [ ] Run tests, extract, translate. Commit `feat(web): keep named fields on a ticket`.

### Task A4: Say what moved

**Files:** Modify `packages/contracts/src/board.ts` (`BoardEventSchema`), `packages/db/src/board-live.ts`, `packages/adapters/src/ticket-changes.ts`, `packages/adapters/src/ticket-tools.ts` (`updateTicket`); Test `packages/db/src/board-live.test.ts`, `packages/adapters/src/ticket-changes.test.ts`, `ticket-tools.test.ts`.

**Interfaces:**
- Produces (contracts): `BoardEventSchema.moved: z.object({ ref: z.string(), title: z.string(), status: TicketStatusSchema, previousStatus: TicketStatusSchema, statusLabel: z.string().optional(), byBotId: Id.nullable(), byName: z.string().nullable() }).optional()`.
- Produces: `TicketChange.moved?: BoardEvent["moved"]`; `BoardEvents.notify(spaceId, change?: { boardId?: string; ticketId?: string; moved?: NonNullable<BoardEvent["moved"]> })`.

- [ ] Failing tests: `updateTicket` that changes status calls `onTicketChange` with `moved` carrying the ref, title, both statuses, the bot's id and name, and the board's label override for the new status; a change of title or owner or a comment sends no `moved`; setting the same status again sends none; a move made by a person sets `byBotId: null` and `byName` to their name; the notifier forwards `moved` to `boardEvents.notify` and `follow` yields it back with the same fields; a payload that is not JSON still yields a bare frame.
- [ ] Run. Expected: FAIL.
- [ ] Implement: in `updateTicket` read `current.status` inside the transaction and build `moved` when `data.status` differs; look up the bot or user name once; extend `createBoardEvents` payload parse with the schema (`safeParse`, dropping an invalid `moved`).
- [ ] Run tests. Commit `feat(adapters): say what moved in a board signal`.

### Task A5: A notice when an agent moves a card to Review or Done

**Files:** Create `apps/web/src/lib/board-stream.ts`, `apps/web/src/lib/board-notifications.ts`, `apps/web/src/pages/shell/use-board-notifications.ts`; Modify `apps/web/src/pages/Board.tsx` (use `followBoard`), `apps/web/src/App.tsx` (`AppFrame` mounts the hook); Test `board-stream.test.ts`, `board-notifications.test.ts`, `use-board-notifications.test.tsx`.

**Interfaces:**
- Produces: `followBoard(subscribe: (signal: AbortSignal) => Promise<AsyncIterable<BoardEvent>>, onEvent: (event: BoardEvent) => void | Promise<void>, onError?: (error: unknown) => void): () => void` (reconnects with the retry rules `Board.tsx` has today; the returned function stops it).
- Produces: `boardMoveNotification(event: BoardEvent, builtin: Record<TicketStatus, string>): { title: string; body: string; tag: string } | null` — non-null only when `moved` exists, `moved.byBotId` is not null and `moved.status` is `review` or `done`; title `"{byName} moved {ref} to {label}"` with `label = statusLabel ?? builtin[status]`, body the ticket title, tag `${ticketId}:${status}`.
- Produces: `useBoardNotifications(enabled: boolean): void`.

- [ ] Failing tests: `boardMoveNotification` for each case (an agent's move to review and to done, a move to doing, a person's move, no `moved`, a heartbeat frame, the override label); `followBoard` yields events, reconnects after a retryable error and stops on abort (reuse the cases `Board.test.tsx` has); the hook, with a fake `Notification`, shows one notification per distinct tag, none while the window is visible and focused (same condition as `deliverBrowserNotification`), none without permission, and asks for permission once when it is `default`; a replayed event with the same `createdAt` shows nothing the second time.
- [ ] Run. Expected: FAIL.
- [ ] Extract the stream loop out of `Board.tsx` into `followBoard` (behaviour unchanged, `Board.test.tsx` stays green), implement the pure function and the hook, mount the hook in `AppFrame` when `ticketBoardEnabled`. Clicking the notification navigates to `/app/board`.
- [ ] Strings: "{name} moved {ref} to {status}". Extract, translate. Commit `feat(web): tell the person when an agent moves a card to review or done`.

### Task A6: The agent tells the person and the Chief

**Files:** Modify `packages/adapters/src/ticket-wake.ts`, `packages/adapters/src/builtin-tools.ts` (`ticket_update` description), `packages/db/src/board.ts` (`chiefBotOf`); Test `ticket-wake.test.ts`, `board.postgres.test.ts`.

**Interfaces:**
- Produces (db): `chiefBotOf(prisma: PrismaClient, spaceId: string): Promise<{ id: string; name: string } | null>` (the non-archived bot with `spawnKey === CHIEF_BOT_SPAWN_KEY`).
- Produces: `ticketWakePrompt(input: { ref: string; chief: { id: string; name: string } | null; assigneeIsChief: boolean }): string`; when a Chief exists and the assignee is not it, the prompt says: when you move this ticket to Review or Done, say so in your chat and send the Chief ("<name>", id `<id>`) a one-line status with `message_bot`.

- [ ] Failing tests: the prompt names the Chief and `message_bot` when there is one, omits the line when there is no Chief and when the assignee is the Chief, and keeps its current wording (work on the ticket, `ticket_get`, comments, status); `chiefBotOf` finds the bot by spawn key, ignores archived and other Spaces' bots.
- [ ] Run. Expected: FAIL.
- [ ] Implement; `wakeTicketAssignee` builds the prompt through `ticketWakePrompt`. Add one sentence to the `ticket_update` description (within the pinned tool-set byte budget in `builtin-tool-bridge.test.ts`; raise that budget only if needed and say so in the commit). The message to the Chief is an instruction to the model: a missed one is acceptable and never blocks the move.
- [ ] Run tests. Commit `feat(adapters): ask an agent to tell the person and the Chief when it finishes a ticket`.

### Task A7: Who is doing what

**Files:** Modify `packages/contracts/src/board.ts` (`ListTicketsInput.statuses`), `apps/api/src/routes/boards.ts` (`tickets.list`), `apps/web/src/pages/Board.tsx`, `apps/web/src/pages/TeamBoard.tsx`, `apps/web/src/pages/TeamPage.tsx`, `apps/web/src/lib/team-roster.ts`; Test the matching tests, `apps/web/e2e/board.spec.ts`.

**Interfaces:**
- Produces: `ListTicketsInput.statuses: z.array(TicketStatusSchema).max(6).optional()` (combined with `status` by union; an empty array means no filter).
- Produces: `ticketsByOwner(tickets: Ticket[]): Map<string, Ticket[]>` in `lib/team-roster.ts` (only `doing`, `review`, `blocked`, newest first).
- Produces: `TeamBoard` prop `tickets: Map<string, Ticket[]>`; each member row lists its tickets' refs and titles, each opening `/app/board?ticket=<ref>`.

- [ ] Failing tests: the route filters by `statuses` and by owner; `ticketsByOwner` groups, keeps only the three statuses and orders; `TeamBoard` shows a member's tickets and nothing for a member with none; a card shows a working mark only when the owner's bot is working and the ticket is `doing`; the board's owner filter hides other owners' cards; Playwright shows the Team screen with a ticket under an agent and the board card mark.
- [ ] Run. Expected: FAIL.
- [ ] Implement. `BoardPage` reads the bots with their live status from the bootstrap (as `TeamPage` does) for the working mark; the owner filter is a select with the Space's agents. Strings: "Everyone" (owner filter option; reuse an existing "All" if one fits). Extract, translate. Commit `feat(web): show what each agent is working on`.

### Task A8: Docs and the Phase A pass

**Files:** Create `docs/boards.md`.

- [ ] Describe the board, labels, fields, the notices, the Chief message and what the agents can do; link the spec. Run the whole affected suites, `tsc` of `contracts db adapters api web desktop`, and `biome`. Commit `docs(boards): describe the board`.

---

## Phase B: several boards

### Task B1: Release 1 (code that does not need one board per Space)

**Files:** Modify `packages/db/prisma/schema.prisma` and a migration `20261111000000_board_archive/migration.sql`; Modify `packages/db/src/board.ts`, `apps/api/src/routes/boards.ts`, `packages/adapters/src/ticket-tools.ts`, `packages/adapters/src/ticket-context.ts`; Test `board.postgres.test.ts`.

**Interfaces:**
- Produces (schema): `Board.archivedAt DateTime?` (additive column only; `spaceId @unique` stays in this release).
- Produces (db): `ensureBoard(prisma, spaceId): Promise<BoardRow>` returns the Space's oldest non-archived-or-not board (`findFirst` ordered by `createdAt`, `id`), creating one only when the Space has none, inside a transaction holding `pg_advisory_xact_lock(hashtext(spaceId))` so two first opens make one board; `boardOfRef(prisma, spaceId, ref): Promise<BoardRow | null>` (finds the board whose prefix matches the ref's prefix ignoring case); `findTicket` unchanged.

- [ ] Failing tests: `ensureBoard` called twice at once on a Space with no board leaves one board (run it 20 times); it returns the oldest board when two exist (insert a second by raw SQL on a test database that has dropped the constraint, or with a different Space-less fixture); `boardOfRef` resolves `lead-4` to the `LEAD` board and `NOPE-1` to null; the routes `tickets.get`, `comments` and `findTicket` callers use the ticket's own board rather than the default one.
- [ ] Run. Expected: FAIL.
- [ ] Implement, replacing every `findUnique({ where: { spaceId } })` on `board` (`grep -rn "board.findUnique" packages apps`). Nothing here creates a second board: the unique index still stops it.
- [ ] Commit `refactor(db): stop assuming a Space has one board`. This task ships in a release before B2.

### Task B2: Release 2 (lift the constraint)

**Files:** Create `packages/db/prisma/migrations/20261112000000_boards_per_space/migration.sql`; Modify `packages/db/prisma/schema.prisma`; Test `packages/db/src/board-migration.test.ts`, `board.postgres.test.ts`.

- [ ] Failing tests: the SQL drops the unique index on `boards("spaceId")`, adds a plain index on it, and creates `CREATE UNIQUE INDEX boards_spaceId_prefix_key ON boards ("spaceId", lower("ticketPrefix"))`; a Postgres test that two boards with prefixes `LEAD` and `lead` in one Space are refused, and `LEAD` and `SUP` are allowed.
- [ ] Run. Expected: FAIL. Implement the migration (the Prisma schema notes the expression index in a comment, as the wiki partial index does).
- [ ] Do not merge before the release containing B1 is out; the PR description says so. Commit `feat(db): let a Space have several boards`.

### Task B3: Board procedures

**Files:** Modify `packages/contracts/src/rpc.ts`, `packages/contracts/src/board.ts`, `apps/api/src/routes/boards.ts`; Test route tests.

**Interfaces:**
- Produces: `boards.create({ name: string, ticketPrefix: string }): Board` (prefix unique ignoring case, else `CONFLICT`); `boards.rename` and `boards.archive`/`boards.unarchive` take `{ boardId }`; archiving the default board is `BAD_REQUEST`; `boards.get({ boardId? })`; `tickets.get`/`comments`/`move` resolve the ticket's own board.

- [ ] Failing tests: create, a duplicate prefix in another case, rename, archive and unarchive, the default board refusing to archive, another Space seeing none of them, a ticket of a second board readable by ref and by id.
- [ ] Run. Expected: FAIL. Implement. Commit `feat(api): create, rename and archive boards`.

### Task B4: Agent tools know boards

**Files:** Modify `packages/adapters/src/ticket-tools.ts`, `run-tools-tasks.ts`, `builtin-tools.ts`; Test `ticket-tools.test.ts`.

**Interfaces:** `board_tickets` and `ticket_create` take optional `board` (prefix, name or id); with none they use the default board and `board_tickets` also returns `boards: [{ id, name, ticketPrefix }]` for non-archived boards; `ticket_get`, `ticket_update`, `ticket_comment` find the ticket by its ref's board; on an archived board `ticket_create` and `ticket_update` return `{ error: "That board is archived." }` and reassignment wakes no one.

- [ ] Failing tests for each rule above, including the wake not being called for an archived board and a ref with an unknown prefix.
- [ ] Run. Expected: FAIL. Implement; keep the descriptions within the tool-set byte budget (raise it only if needed). Commit `feat(adapters): let agents choose a board`.

### Task B5: The selector and board settings

**Files:** Modify `apps/web/src/pages/Board.tsx`, `apps/web/src/lib/query.ts` (board in query keys); Create `apps/web/src/components/BoardSelector.tsx`; Test `BoardSelector.test.tsx`, `Board.test.tsx`, `board.spec.ts`.

**Interfaces:** `BoardSelector({ boards, boardId, onChange, onCreate }): ReactNode` — a menu in the header showing the current board's name and listing the non-archived boards, with "New board". The URL carries `?board=<prefix>`; with none the default board shows. Board settings gains name, prefix (editable only while the board has no tickets, as today), archive, and the column names from A2.

- [ ] Failing tests: the selector lists boards and changes the board; the board list refetches per board; "New board" creates one and opens it; the settings archive refuses the default board (button absent); the Playwright case creates "Leads", sees its own columns and tickets, and goes back to the first board.
- [ ] Run. Expected: FAIL. Implement with the existing `DropdownMenu`. Strings: "New board", "Boards" (accessible name), "Prefix", "Archive board"; reuse existing ones where they exist. Extract, translate. Commit `feat(web): switch between boards from the header`.

### Task B6: Docs and the Phase B pass

- [ ] Extend `docs/boards.md` (several boards, prefixes, archiving, the tool `board` parameter, the two-release rollout). Run the affected suites, `tsc` and `biome`. Commit `docs(boards): describe several boards`.
