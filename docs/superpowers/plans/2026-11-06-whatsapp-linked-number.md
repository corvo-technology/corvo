# WhatsApp numbers for agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A person links a WhatsApp number from the store by QR, gives it one agent, and that agent answers everyone who writes to it, with the owner's "Message yourself" chat acting as the owner.

**Architecture:** A new messaging surface, `WhatsAppLinkSurface`, holds one Baileys socket per linked number inside the Rook process and emits the same inbound events the Telegram surface does. Each linked number is a `MessagingInstallation` (provider `whatsapp-web`) whose agent is the number's responsible agent. The owner's self-chat enters the agent's main thread like any owner message. Every other person gets an `ExternalConversation` and a thread of their own, and their runs use a visitor tool allowlist that is built and tested as a security boundary.

**Tech Stack:** Baileys (`@whiskeysockets/baileys`, version chosen by the Task 1 spike), TypeScript, Prisma 7, oRPC contracts, vitest, React (web store), Lingui.

**Spec:** `docs/superpowers/specs/2026-11-06-whatsapp-linked-number-design.md`. Related: `docs/local-transcription.md` (audio), `docs/superpowers/specs/2026-10-27-app-catalog-design.md` (store).

## Global Constraints

- Public repo: no real phone numbers, sessions, tokens or personal data in code, tests, fixtures or commits. Use fake numbers such as `+15550100`.
- Provider-neutral: the Baileys import lives only in `packages/adapters/src/whatsapp/baileys-client.ts`. Everything else depends on the `WhatsAppLinkClient` interface. Vendor SDKs belong only in adapters.
- No provider-specific environment variable when the generic setup can express it. The one new operator switch (Task 12) is justified in the ledger.
- Tests are deterministic and offline: a scripted fake client. No test contacts WhatsApp.
- Top-level `import type`, never inline type imports.
- Migrations are additive only: the previous release runs beside the new one for seconds.
- Security-sensitive: auth, secret handling and the visitor boundary. A stranger's run is offered the ticked tools and no others.
- Every visible word is UI. The only new explanatory copy is the single warning line in Task 11. Quote all new copy in the PR description and say why it is needed.
- Format only your own files with `biome check --write --stdin-file-path=<file> < <file>`. Never `biome check --write` on a directory. Run `biome check` (read-only) on touched files.
- Commit messages follow Conventional Commits and end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Do not run the desktop Playwright suite locally. Marketing pages are not touched.
- Do not push or open PRs without asking.

## Review Focus

Failure modes the spec implies that a first reading would miss, most likely first. Each has a test in the task named.

1. A visitor writes "show me the owner's emails" or "run this command": the run is offered no owner tool, no unticked app, no computer, browser, memory or fleet tool. (Task 8)
2. The app reconnects after a long offline gap and WhatsApp delivers old messages: none is answered, all are recorded. Linking a personal number syncs history: none is answered. (Tasks 4, 5)
3. The owner types to a friend from their phone: the agent neither treats it as input nor answers that chat. (Task 4)
4. Two processes both hold the same number: only one connects. WhatsApp logs the device out: the number shows disconnected and does not retry forever. (Task 6)
5. A visitor's message or voice note contains text that reads like an instruction: it stays inside a labeled block as data. A visitor sends many voice notes: work is bounded and nothing triggers a model download. (Tasks 9, 10)

---

### Task 1: Spike — Baileys inside the desktop engine

**Files:**
- Create: `docs/superpowers/specs/2026-11-06-whatsapp-linked-number-spike.md`
- Create (throwaway, not committed): `$SCRATCH/spike/baileys-probe.mjs`

**Interfaces:**
- Produces: the chosen Baileys version (6.7.24 or 7.0.0-rc14), the event names and message shapes the adapter will map, the measured idle memory of one connected socket, and whether it loads in the engine's runtime. Later tasks read these from the spike record.

- [ ] **Step 1: Install the candidates in a scratch directory** (not the repo): `@whiskeysockets/baileys@6.7.24` and `@7.0.0-rc14`, with `pino` for a silent logger.
- [ ] **Step 2: Load each in Electron 45 as Node** (`ELECTRON_RUN_AS_NODE=1` with the installed desktop app's binary, as the engine starts the API) and in Node 24. Record whether the ESM import works and whether a native module is needed.
- [ ] **Step 3: Probe the offline API surface** without a phone: create a socket with an in-memory auth state, confirm the QR event fires and records its string, and list the event names for connection updates, messages, history sync and logout.
- [ ] **Step 4: Ask the owner to scan the QR once with a spare number** and send one text, one voice note and one image to it, and a message in "Message yourself". Record: the JID shapes of a self-chat, a one-to-one chat and a group; the `fromMe` flag on each; how a voice note and an image are downloaded; typing presence and read receipt calls; the logout event; and the pairing-code call.
- [ ] **Step 5: Measure** resident memory of the process before, with one idle connected socket, and with three sockets. State what a dozen would cost.
- [ ] **Step 6: Write the spike record** with a go or no-go, the chosen version with the reason, and every finding that changes the build, in the style of `docs/superpowers/specs/2026-11-05-local-transcription-engine-spike.md`. Commit.

```bash
git add docs/superpowers/specs/2026-11-06-whatsapp-linked-number-spike.md
git commit -m "docs: record the Baileys engine spike"
```

---

### Task 2: Data model

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (`MessagingInstallation`, new `WhatsAppAuthEntry`)
- Create: `packages/db/prisma/migrations/20261112000000_whatsapp_linked_numbers/migration.sql`
- Modify: `packages/db/src/row-security.ts`
- Test: the migration tests next to the existing messaging-installations migration test

**Interfaces:**
- Produces on `MessagingInstallation`: `visitorConnectors String[] @default([])` (connector ids a visitor's run may use), `pausedAt DateTime?`, `status String @default("active")` (`active` | `disconnected`).
- Produces `WhatsAppAuthEntry { installationId, name, ciphertext, updatedAt }` with `@@id([installationId, name])`, cascading on installation delete.

- [ ] **Step 1: Write the failing migration test** asserting the three columns exist with their defaults, the new table exists, deleting an installation deletes its entries, and the table is covered by row security like `messaging_installations`.
- [ ] **Step 2: Run it** and confirm it fails because the migration is missing.
- [ ] **Step 3: Add the models and the additive migration.** Only add columns and a table. Register the table in `row-security.ts` the way `messaging_installations` is.
- [ ] **Step 4: Run the db tests** (`./node_modules/.bin/vitest run packages/db`) and `prisma generate`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): store linked WhatsApp numbers`.

---

### Task 3: The client contract and the scripted fake

**Files:**
- Create: `packages/adapters/src/whatsapp/client.ts`
- Create: `packages/adapters/src/whatsapp/scripted-client.ts`
- Test: `packages/adapters/src/whatsapp/scripted-client.test.ts`

**Interfaces:**
- Produces in `client.ts`:
  - `type WhatsAppChat = { id: string; kind: "self" | "direct" | "group" }`
  - `type WhatsAppIncoming = { chat: WhatsAppChat; messageId: string; senderId: string; senderName?: string; fromMe: boolean; text: string; media?: { kind: "audio" | "image" | "file"; mimeType: string; name?: string; size: number; download(): Promise<Uint8Array> }; sentAt: Date; history: boolean }` (`history` is true for messages WhatsApp replays from before the link or while offline)
  - `type WhatsAppConnectionEvent = { state: "qr"; qr: string } | { state: "open"; number: string } | { state: "closed"; reason: "logged-out" | "replaced" | "network" }`
  - `interface WhatsAppLinkClient { connect(): Promise<void>; onConnection(cb): void; onMessage(cb: (m: WhatsAppIncoming) => void): void; sendText(chatId: string, text: string): Promise<{ id: string }>; setTyping(chatId: string, on: boolean): Promise<void>; markRead(chatId: string, messageId: string): Promise<void>; logout(): Promise<void>; close(): Promise<void> }`
  - `type WhatsAppClientFactory = (auth: WhatsAppAuthStore) => WhatsAppLinkClient`
  - `interface WhatsAppAuthStore { get(name: string): Promise<string | undefined>; set(name: string, value: string | undefined): Promise<void>; clear(): Promise<void> }`
- Produces `ScriptedWhatsAppClient` with `emitConnection(event)`, `emitMessage(incoming)`, and recorded `sent`, `typing`, `read` arrays.

- [ ] **Step 1: Write failing tests for the fake**: events reach subscribers in order, `sendText` records, `logout` clears the auth store and emits `closed` with `logged-out`.
- [ ] **Step 2: Run to confirm failure** (`./node_modules/.bin/vitest run packages/adapters/src/whatsapp/scripted-client.test.ts`).
- [ ] **Step 3: Implement the types and the fake.**
- [ ] **Step 4: Run to confirm PASS. Commit** `feat(adapters): define the linked WhatsApp client contract`.

---

### Task 4: The Baileys client

**Files:**
- Create: `packages/adapters/src/whatsapp/baileys-client.ts`
- Create: `packages/adapters/src/whatsapp/map-message.ts`
- Modify: `packages/adapters/package.json`, `pnpm-lock.yaml` (the version from the spike; splice only the new lock entries, never churn the lockfile)
- Test: `packages/adapters/src/whatsapp/map-message.test.ts`

**Interfaces:**
- Consumes: the Task 3 contract and the Task 1 spike record for event names and JID shapes.
- Produces `createBaileysClient: WhatsAppClientFactory`, and `mapIncoming(raw, ownJid): WhatsAppIncoming | undefined` (a pure function over recorded sample payloads taken from the spike).

- [ ] **Step 1: Write failing tests for `mapIncoming`** with sample payloads from the spike: the self-chat is `kind: "self"`; a one-to-one chat is `direct`; a group is `group`; the owner's message in a friend's chat has `fromMe: true`; a history replay has `history: true`; a voice note maps to `media.kind: "audio"`; a reaction or protocol message returns `undefined`.
- [ ] **Step 2: Run to confirm failure.**
- [ ] **Step 3: Implement `mapIncoming` and `createBaileysClient`.** The client builds Baileys' auth state from `WhatsAppAuthStore`, silences the library logger, maps `connection.update` to `WhatsAppConnectionEvent` (a logged-out close is `logged-out`, not `network`), and never reconnects after a logged-out or replaced close.
- [ ] **Step 4: Run the tests. Add the dependency to the desktop externals** in `apps/desktop/scripts/build-engine.mjs` and `apps/desktop/package.json` the way `sherpa-onnx-node` was added, and extend `apps/desktop/src/engine-externals.test.ts`'s expectations. Run `./node_modules/.bin/vitest run apps/desktop/src/engine-externals.test.ts packages/adapters/src/whatsapp`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(adapters): add the Baileys WhatsApp client`.

---

### Task 5: Classifying a message

**Files:**
- Create: `packages/adapters/src/whatsapp/classify.ts`
- Test: `packages/adapters/src/whatsapp/classify.test.ts`

**Interfaces:**
- Produces `classifyIncoming(m: WhatsAppIncoming, state: { paused: boolean; linkedAt: Date; resumedAt?: Date; now: Date }): "owner" | "visitor" | "record" | "ignore"`. `owner`: a self-chat message that is not history. `visitor`: a direct chat message from someone else, not `fromMe`, not history, not older than `LATE_MESSAGE_MS` (10 minutes, exported), number not paused. `record`: history, late, paused or before `linkedAt`/`resumedAt`: stored but never answered. `ignore`: groups, `fromMe` messages outside the self-chat, empty messages.

- [ ] **Step 1: Write the failing table test** with one row per case above, plus: a message sent while paused and read after resume is `record`; a message 11 minutes old is `record`; the same message at 9 minutes is `visitor`.
- [ ] **Step 2: Run to confirm failure.**
- [ ] **Step 3: Implement `classifyIncoming`** as a pure function.
- [ ] **Step 4: Run to confirm PASS. Commit** `feat(adapters): classify WhatsApp messages as owner, visitor, recorded or ignored`.

---

### Task 6: The surface that holds the sockets

**Files:**
- Create: `packages/adapters/src/whatsapp/link-surface.ts`
- Create: `packages/adapters/src/whatsapp/db-auth-store.ts`
- Modify: `packages/adapter-kit/src/types.ts` (add `audience?: "owner" | "visitor" | "record"` to `MessagingInboundMessage`)
- Test: `packages/adapters/src/whatsapp/link-surface.test.ts`, `packages/adapters/src/whatsapp/db-auth-store.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 3 and 5; `SecretStore` from `@corvo/adapter-kit`; the `MessagingSurface` interface in `packages/adapter-kit/src/interfaces.ts`.
- Produces `class WhatsAppLinkSurface implements MessagingSurface` with the extra methods `startLink(input: { spaceId; userId; botId }): Promise<{ linkId: string }>`, `linkStatus(linkId: string): { state: "qr" | "linked" | "failed"; qr?: string; number?: string }`, `pause(installationId)`, `resume(installationId)`, `disconnect(installationId)`. `initialize()` connects every active installation; `shutdown()` closes every socket. Inbound events go to the sink registered with `onInbound`, as `MessagingInboundMessage` with `provider: "whatsapp-web"`, `installationSpaceId`, and a new optional field `audience: "owner" | "visitor"`.
- Produces `class DbWhatsAppAuthStore implements WhatsAppAuthStore` encrypting each value with the `SecretStore` and storing it in `WhatsAppAuthEntry`.

- [ ] **Step 1: Write failing auth store tests**: values round-trip encrypted, `set(name, undefined)` deletes, `clear()` removes all of one installation's entries and no other's.
- [ ] **Step 2: Write failing surface tests with the scripted client**: a QR event is reported by `linkStatus`; an `open` event creates the installation with a masked display name and the chosen agent and reports `linked`; an owner message reaches the sink with `audience: "owner"` and a visitor message with `audience: "visitor"`; `record` and `ignore` classes never reach the sink; `pause` stops delivery and `resume` sets `resumedAt`; a `logged-out` close sets the installation `status` to `disconnected` and the client is not asked to reconnect; `disconnect` calls `logout` and deletes the installation and its auth entries.
- [ ] **Step 3: Write the failing one-holder test**: two surfaces over the same installation, with a fake lock that grants one holder. Only one client connects. Releasing the lock lets the other take over on its next attempt.
- [ ] **Step 4: Run to confirm all fail.**
- [ ] **Step 5: Implement both classes.** Take a Postgres advisory lock keyed by installation id before connecting (the pattern `job-reconciler.ts` uses); on desktop the single process always wins it. Messages in `record` are stored as `ExternalMessage` rows with status `recorded` (Task 8 owns that write; here the surface emits them to the sink with `audience: "record"`).
- [ ] **Step 6: Run to confirm PASS. Commit** `feat(adapters): hold linked WhatsApp numbers in the Rook process`.

---

### Task 7: Link and manage numbers over the API

**Files:**
- Modify: `packages/contracts/src/rpc.ts` (a `messaging.whatsapp` group), `packages/contracts/src/domain.ts`
- Create: `apps/api/src/routes/whatsapp.ts`; wire it in `apps/api/src/router.ts`
- Test: `apps/api/src/routes/whatsapp.test.ts`

**Interfaces:**
- Produces RPC `messaging.whatsapp`: `link.start({ botId })` → `{ linkId }`; `link.status({ linkId })` → `{ state; qr?; number? }`; `numbers.list()` → `Array<{ id; number: string /* masked */; botId; status; paused: boolean; visitorConnectors: string[] }>`; `numbers.update({ id, botId?, visitorConnectors?, paused? })`; `numbers.disconnect({ id })`.
- Consumes `WhatsAppLinkSurface` from Task 6 through the composition root.

- [ ] **Step 1: Write failing route tests**: only the signed-in owner of the space may call any of them; `botId` must be one of the caller's own agents; `visitorConnectors` accepts only connector ids the caller has connected; the number is always masked in `list`; unavailable when the transport is disabled (Task 12) returns a clear error.
- [ ] **Step 2: Run to confirm failure.**
- [ ] **Step 3: Implement the contract and routes.**
- [ ] **Step 4: Run `./node_modules/.bin/vitest run apps/api/src/routes/whatsapp.test.ts packages/contracts`. Expected: PASS. Commit** `feat(api): link and manage WhatsApp numbers`.

---

### Task 8: Owner and visitor conversations

**Files:**
- Create: `apps/api/src/whatsapp-inbound.ts`
- Modify: `apps/api/src/app.ts` (register the handler where the Telegram one is), `packages/core/src/messaging-prompts.ts`
- Test: `apps/api/src/whatsapp-inbound.test.ts`

**Interfaces:**
- Consumes: the sink events from Task 6; `sendUserMessage` from `packages/db/src/events.ts`; the `ExternalConversation` and `ExternalMessage` models.
- Produces `createWhatsAppInboundHandler(deps): (event: MessagingInboundMessage) => Promise<void>`, and in core `isVisitorRun(trigger: string, sourceBlocks: MessageBlock[] | undefined): boolean` (true for a `messaging` run whose source message has a block of kind `visitor_message`).
- Behavior: `audience: "owner"` goes to the installation agent's main thread as a normal owner message. `audience: "visitor"` finds or creates the `ExternalConversation` (`provider: "whatsapp-web"`, `workspaceId: installationId`, `externalKey: chat id`), its own thread, stores the message, and starts a run whose source message carries a `visitor_message` block. `audience: "record"` stores an `ExternalMessage` with status `recorded` and starts nothing. Replies are written to `MessagingOutbound` with `kind: "visitor"` and the conversation's provider thread id, so delivery survives a restart.

- [ ] **Step 1: Write failing tests**: an image or file sent by a visitor is stored as an attachment the way `storeInboundMedia` in `apps/api/src/messaging-inbound.ts` stores Telegram media; an owner message lands in the agent's main thread and starts one run; two different visitors get two conversations and threads, and neither run's context contains the other's messages; the same message delivered twice starts one run; a recorded message starts no run; changing the installation's agent leaves existing conversations with the agent that had them.
- [ ] **Step 2: Run to confirm failure.**
- [ ] **Step 3: Implement the handler and `isVisitorRun`.**
- [ ] **Step 4: Run. Commit** `feat(api): route WhatsApp owner and visitor messages to agents`.

---

### Task 9: The visitor boundary

**Files:**
- Modify: `packages/adapters/src/run-tool-selection.ts`, `packages/adapters/src/executor.ts`
- Test: `packages/adapters/src/run-tool-selection.visitor.test.ts`, `packages/adapters/src/executor-visitor.test.ts`

**Interfaces:**
- Consumes `isVisitorRun` (Task 8) and `MessagingInstallation.visitorConnectors` (Task 2).
- Produces `VISITOR_BUILTIN_TOOLS: ReadonlySet<string>`, the allowlist of built-in tools a visitor run may be offered: the reply tools only (`message_user`, `request_clarification` if it exists, and the ticket tools only when the ticket board is enabled). `selectBuiltinToolsForRun` takes `visitorRun: boolean` and, when true, returns only tools in that set. The executor's connector tools for a visitor run are only those whose connector id is in the installation's `visitorConnectors`.

- [ ] **Step 1: Write the failing boundary test** as a table over `builtinAgentTools`: for a visitor run, every built-in tool not in `VISITOR_BUILTIN_TOOLS` is absent. Name the groups explicitly so a new tool added later is absent by default: computer and browser tools, memory and wiki tools, fleet and bot-management tools, `message_bot`, `handoff_to_bot`, `connect_agent`, call and media tools, routine tools.
- [ ] **Step 2: Write the failing executor test**: with two connected apps and one ticked, a visitor run's connector tools contain only the ticked app's; with none ticked there are none; the run's prompt contains the visitor message inside a labeled block that says it is untrusted text from an outside person.
- [ ] **Step 3: Write the mutation test**: removing the `visitorRun` filter makes the table test fail. Run it once by hand and record that it failed.
- [ ] **Step 4: Run to confirm failures.**
- [ ] **Step 5: Implement the allowlist and the connector restriction.** An allowlist, not a denylist: a tool is off unless named.
- [ ] **Step 6: Run `./node_modules/.bin/vitest run packages/adapters/src/run-tool-selection packages/adapters/src/executor`. Expected: PASS. Commit** `feat(adapters): limit a visitor's run to the tools the owner ticked`.

---

### Task 10: Pacing and limits

**Files:**
- Create: `packages/adapters/src/whatsapp/pacing.ts`
- Modify: `packages/adapters/src/whatsapp/link-surface.ts`, `apps/api/src/whatsapp-inbound.ts`
- Test: `packages/adapters/src/whatsapp/pacing.test.ts`

**Interfaces:**
- Produces `createPacer(options: { clock; random }): { beforeSend(chatId: string, text: string): Promise<void>; allowIncoming(numberId: string, senderId: string): boolean }`. `beforeSend` sets typing, waits a delay that grows with the text length (about 40 ms per character, between 1 and 8 seconds, with up to 30% jitter) and clears typing. A number sends at most 20 messages per minute. `allowIncoming` allows 6 runs per sender per 10 minutes and 60 per number per 10 minutes, and returns false beyond that, with no reply sent. The numbers are exported constants the owner can change later.

- [ ] **Step 1: Write failing tests with a fake clock**: the delay scales with length and stays within bounds; the 21st send in a minute waits for the next window; the 7th message from one sender in 10 minutes is dropped, and the sender's count resets after the window; one sender hitting the limit does not block another.
- [ ] **Step 2: Run to confirm failure. Implement. Run to confirm PASS.**
- [ ] **Step 3: Use the pacer** in the surface's `sendToThread` and in the inbound handler's visitor path. Add a surface test that a reply is preceded by typing on and followed by typing off.
- [ ] **Step 4: Commit** `feat(adapters): pace WhatsApp replies and limit incoming work`.

---

### Task 11: Audio from visitors

**Files:**
- Modify: `apps/api/src/audio-hold.ts`, `apps/api/src/whatsapp-inbound.ts`, `packages/adapters/src/audio-transcription.ts`
- Test: `apps/api/src/whatsapp-audio.test.ts`, additions to `packages/adapters/src/audio-transcription.test.ts`

**Interfaces:**
- Consumes the local transcription feature (`docs/local-transcription.md`): `startRunOrAwaitAudio`, `transcribeAudioArtifact`, `LocalModelStore`.
- Produces an option `allowVisitor: true` on `startRunOrAwaitAudio`'s input (today it requires `fromOwner`), and an option `noDownload: true` on `transcribeAudioArtifact`'s input.

- [ ] **Step 1: Write failing tests**: a visitor's voice note is stored as an artifact, held, and transcribed with the provider the owner selected (local or hosted, with the owner's consent check unchanged); with no provider selected the local model is used; with the local model absent, a visitor's audio is not transcribed and no download starts (`ensure` is not called) and the agent gets the "not transcribed" note; a second visitor audio while one is transcribing for the same number waits in a queue of at most 3 and the fourth is attached with a note; an audio over 8 MiB is a file with a note.
- [ ] **Step 2: Run to confirm failure.**
- [ ] **Step 3: Implement.** The owner's own audio keeps its current behavior, including the first-use download.
- [ ] **Step 4: Run the audio and WhatsApp tests. Expected: PASS. Commit** `feat(api): transcribe a visitor's voice notes with the owner's speech provider`.

---

### Task 12: Enabling the transport and wiring it in

**Files:**
- Modify: `apps/api/src/env.ts`, `apps/api/src/app.ts`, `apps/worker/src/index.ts`, `packages/adapters/src/messaging-composition.ts`, `packages/core/src/messaging-providers.ts`, `infra/compose/docker-compose*.yml`, `infra/updater/src/compose-env.test.ts` (only if the test requires it)
- Test: `apps/api/src/env.test.ts`, `packages/core/src/messaging-providers.test.ts`

**Interfaces:**
- Produces one operator switch, `WHATSAPP_LINKED_DEVICES_ENABLED`. The transport mounts when the desktop stack token is set, or when the switch is `1`. A server without either never mounts it, so no number can be linked and no socket opens. `messagingProviderName("whatsapp-web")` is `"WhatsApp"`.

- [ ] **Step 1: Write failing tests**: the env parser reads the switch; the transport is off with neither condition, on with the desktop token, on with the switch; the provider label is "WhatsApp".
- [ ] **Step 2: Run to confirm failure. Implement. Run to confirm PASS.**
- [ ] **Step 3: Pass the switch** to the api and worker in every compose file as the existing optional variables are passed (empty by default), then run `./node_modules/.bin/vitest run infra/updater/src/compose-env.test.ts`. Expected: PASS.
- [ ] **Step 4: Compose the surface** in the API and worker roots next to the Telegram surface, call `initialize()` at start and `shutdown()` at stop.
- [ ] **Step 5: Commit** `feat(api): enable linked WhatsApp numbers on the desktop and where the operator turns them on`.

---

### Task 13: The store card and the link flow

**Files:**
- Create: `apps/web/src/pages/WhatsAppLinkOverlay.tsx`, `apps/web/src/pages/WhatsAppNumbers.tsx`
- Modify: `apps/web/src/pages/StoreInstalledApps.tsx` and the store grid that lists apps (`AppCatalogGrid.tsx`), `apps/web/src/locales/*/messages.po` (run `intl:extract`)
- Test: `apps/web/src/pages/WhatsAppLinkOverlay.test.tsx`, `apps/web/src/pages/WhatsAppNumbers.test.tsx`, `apps/web/e2e/whatsapp.spec.ts`

**Interfaces:**
- Consumes the Task 7 RPC. Uses the existing shadcn components from `packages/ui-web` and the existing QR rendering helper if the repo has one (search before adding a library; if none, render the QR with a small vendored library and record that in the ledger).
- Copy, exactly: the card name "WhatsApp"; the warning "This uses WhatsApp without the official API. WhatsApp can ban the number."; list actions "Pause", "Resume", "Disconnect". No other explanatory text.

- [ ] **Step 1: Write failing component tests**: the card appears only when the transport is enabled; **Add** shows the warning line and then the QR from `link.status`; scanning (`state: "linked"`) moves to the agent picker; picking an agent ends the flow and the number appears masked with the agent's name; Pause, Resume, Disconnect call the right routes; the visitor-apps control lists only the owner's connected apps.
- [ ] **Step 2: Run to confirm failure. Implement. Run to confirm PASS.**
- [ ] **Step 2b: Check that each visitor's conversation appears in the app's thread list and that the owner can open it and write in it.** Write a test for whatever is missing (a list filter, a label with the masked number) and add it. Nothing more than a name and the masked number is shown.
- [ ] **Step 3: Write the e2e spec** that opens the store screen and the link overlay against the scripted client, for CI to screenshot. Do not run it locally.
- [ ] **Step 4: Run `pnpm intl:extract`, check the catalogs changed only for the new strings. Commit** `feat(web): add WhatsApp to the store`.

---

### Task 14: Desktop packaging and documentation

**Files:**
- Create: `docs/whatsapp.md`
- Modify: `apps/desktop/scripts/build-engine.mjs`, `apps/desktop/package.json` (if Task 4 did not already finish it)

- [ ] **Step 1: Build the unsigned package directory** (`CSC_IDENTITY_AUTO_DISCOVERY=false pnpm --filter @corvo/desktop pack:dir`, no window) and run the Task 1 probe against the packaged app's own runtime to confirm the library loads from the asar.
- [ ] **Step 2: Write `docs/whatsapp.md`**: what it does, the two roles (the owner's chat and visitors), the visitor boundary in one table, how to link and remove a number, the ban risk, the pacing and limits, and that it is off on a server unless the operator turns it on.
- [ ] **Step 3: Run the whole suite** (`./node_modules/.bin/vitest run`) and `biome check` on the touched files. Record any failure by name.
- [ ] **Step 4: Commit** `docs: describe WhatsApp numbers for agents` and `build(desktop): ship the WhatsApp engine`.
