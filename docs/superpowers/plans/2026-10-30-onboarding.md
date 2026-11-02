# Onboarding Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the survey, model and automatic-Chief onboarding with a five-step guided flow (Workspace, Uso, Modelo, Primeiro bot, Computador) with a sidebar and progress, ending in the chosen bot's chat.

**Architecture:** Web only (Electron hosts it). A pure step module decides which steps exist, which are complete and what comes next from `Me` and session answers; small step components render each step inside one `OnboardingLayout`. `Onboarding.tsx` keeps the model step and the `/onboarding/:step?` route and becomes a thin state machine. No new API and no migration: every write goes through an existing RPC.

**Tech Stack:** React, react-router, Lingui (`<Trans>`, `useLingui`), `@corvo/ui-web` (shadcn on Base UI), vitest + testing-library, Playwright (CI only).

**Spec:** `docs/superpowers/specs/2026-10-30-onboarding-design.md`

## Global Constraints

- Public repo: no secrets, real data or personal paths in code, tests, fixtures or commits.
- Colors only through `@corvo/ui-tokens` semantic tokens; never hardcoded hex and never `[var(--…)]` arbitrary values. Reuse `@corvo/ui-web` components before hand-writing chrome.
- Top-level `import type`, never inline type imports. No dynamic `import()` except deferred loading.
- Minimal copy. Every new visible string is justified in the PR description (quote it, why needed, why not removable).
- Every user-facing string goes through Lingui; run `pnpm --filter @corvo/web intl:extract` and fill `pt-BR`.
- Judge meaning with an LLM, never keyword lists: template ordering uses only the structured `StoreCategory` picks.
- No new dependencies. No server migration. Tests deterministic and offline.
- Do not run the desktop Playwright suite locally; web e2e specs run in CI.
- Work on a new branch from `main` (not `social-image`). Commit only when the user asks; the commit steps below apply once they do. Commit messages end with the attribution line from the session.
- Mobile is out of scope; do not change any RPC contract.

## Review Focus

- Workspace name blank, whitespace only, or longer than the `spaceName` limit: inline error, no `spaces.rename` call.
- A member who cannot rename the Space (`canRename` false): the Workspace step is not shown.
- Reload on `/onboarding/bot` after the Chief and a bot were already made: no duplicate Chief or bot.
- Direct URL to `/onboarding/computer` on web or on a hosted server: lands on the next visible step, not an empty screen.
- `addCatalogAgent` fails (offline): the selection stays, an error with retry shows, and no navigation happens.

---

### Task 1: Step logic

**Files:**
- Create: `apps/web/src/lib/onboarding-steps.ts`
- Test: `apps/web/src/lib/onboarding-steps.test.ts`

**Interfaces:**
- Produces:
  - `type OnboardingStepId = "workspace" | "survey" | "model" | "bot" | "computer"` (`survey` is the Uso step and keeps its URL).
  - `type OnboardingContext = { canRenameSpace: boolean; spaceName: string; needsModel: boolean; canChooseHostComputer: boolean; computerHost: "docker" | "this-mac" | null; hasDesktopHostChoice: boolean }`
  - `visibleSteps(ctx: OnboardingContext): OnboardingStepId[]`: always in the order above; omits `workspace` when `!canRenameSpace`, `model` when `!needsModel`, `computer` unless `canChooseHostComputer && computerHost === null && hasDesktopHostChoice`.
  - `nextStep(ctx, current: OnboardingStepId): OnboardingStepId | null` (`null` means finished).
  - `resolveStep(ctx, requested: string | undefined): OnboardingStepId`: a visible requested step, else the first visible one, else `"bot"`.
  - `progress(visible: OnboardingStepId[], done: ReadonlySet<OnboardingStepId>): { done: number; total: number; percent: number }`.
  - `orderTemplates(entries: readonly AgentCatalogEntry[], categories: readonly StoreCategory[]): AgentCatalogEntry[]`: entries whose `category` is picked first, then the rest, each group in catalog order (stable).

- [ ] **Step 1: Create the branch** — `git switch main && git pull && git switch -c onboarding-flow`.
- [ ] **Step 2: Write failing tests** covering: `visibleSteps` for the four omissions above and the all-present case; `nextStep` returns `null` after the last visible step and skips omitted ones; `resolveStep(ctx, "computer")` returns the first visible step when `computer` is hidden, and `resolveStep(ctx, undefined)` the first visible; `progress` gives `{done:2,total:5,percent:40}` for 2 of 5 and `percent:100` when `total` is 0; `orderTemplates(AGENT_CATALOG, ["sales"])` starts with every `sales` entry, keeps catalog order inside each group and returns the same length with no duplicates.
- [ ] **Step 3: Run** `pnpm exec vitest run apps/web/src/lib/onboarding-steps.test.ts` — expect FAIL (module missing).
- [ ] **Step 4: Implement** the signatures above in `onboarding-steps.ts` as pure functions.
- [ ] **Step 5: Run the same command** — expect PASS.
- [ ] **Step 6: Commit** `apps/web/src/lib/onboarding-steps*.ts` — "Add onboarding step logic".

### Task 2: Share the host computer choice

**Files:**
- Create: `apps/web/src/lib/host-computer.ts`
- Modify: `apps/web/src/pages/HostComputerPrompt.tsx:84-110`
- Test: `apps/web/src/lib/host-computer.test.ts`

**Interfaces:**
- Produces: `chooseHostComputer(desktop: CorvoDesktop | undefined, choice: "docker" | "this-mac"): Promise<boolean>`: resolves `false` when the person declines the native "this-mac" confirmation, `true` once saved; throws `Error("Local computer access requires the latest desktop app.")` when `desktop?.computer?.managesHostChoice` is falsy. `this-mac` calls `desktop.computer.requestAccess()`; `docker` calls `revokeAccess()`.

- [ ] **Step 1: Write failing tests** with a fake `desktop`: `this-mac` returns `false` when `requestAccess` resolves `false` and `true` when it resolves `true`; `docker` calls `revokeAccess` and returns `true`; no `managesHostChoice` rejects with the message above.
- [ ] **Step 2: Run** `pnpm exec vitest run apps/web/src/lib/host-computer.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `chooseHostComputer` by moving the body of the `try` block in `HostComputerPrompt.choose` (the lines that check `managesHostChoice` and call `requestAccess`/`revokeAccess`) into it; `choose` then calls it and keeps its own error and `pending` handling.
- [ ] **Step 4: Run** the new test and `pnpm exec vitest run apps/web/src/pages` — expect PASS, existing HostComputerPrompt tests unchanged.
- [ ] **Step 5: Commit** — "Share the host computer choice".

### Task 3: Layout with sidebar and progress

**Files:**
- Create: `apps/web/src/pages/onboarding/OnboardingLayout.tsx`
- Test: `apps/web/src/pages/onboarding/OnboardingLayout.test.tsx`

**Interfaces:**
- Consumes: `OnboardingStepId`, `progress` (Task 1).
- Produces: `OnboardingLayout(props: { steps: { id: OnboardingStepId; label: string; detail?: string }[]; current: OnboardingStepId; done: ReadonlySet<OnboardingStepId>; onBack?: () => void; children: ReactNode })`. Sidebar lists steps with a completed check, the active step highlighted and a connector line; a progress bar (`role="progressbar"` with `aria-valuenow` from `progress`); a back button only when `onBack` is set; children in a max-width main area. Below the `md` breakpoint the sidebar collapses to the progress bar and the current step label. Completion is never shown by color alone (check icon plus text for assistive tech). The bar animates only under `motion-safe:`.

- [ ] **Step 1: Write failing tests**: renders every step label; marks the current one `aria-current="step"`; a done step exposes an accessible "completed" text; progressbar `aria-valuenow` equals `progress(...).percent`; no back button without `onBack`, a "Back" button calls it.
- [ ] **Step 2: Run** `pnpm exec vitest run apps/web/src/pages/onboarding/OnboardingLayout.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement** with `@corvo/ui-web` `Button` and Tailwind token classes already used by `Onboarding.tsx`; icons from `lucide-react` (`Check`).
- [ ] **Step 4: Run** the test — expect PASS.
- [ ] **Step 5: Commit** — "Add the onboarding layout".

### Task 4: Workspace step

**Files:**
- Create: `apps/web/src/pages/onboarding/WorkspaceStep.tsx`
- Test: `apps/web/src/pages/onboarding/WorkspaceStep.test.tsx`

**Interfaces:**
- Produces: `WorkspaceStep(props: { spaceId: string; initialName: string; onDone: (name: string) => void })`. One text input labelled "Workspace name", a Continue button. Trimmed name unchanged: calls `onDone` without any RPC. Blank or longer than the `spaceName` limit in `@corvo/contracts`: shows an inline error and does not call RPC. Otherwise calls `rpc.spaces.rename({ spaceId, name })` once (button disabled while pending), then `onDone(result.name)`; a failure shows `errorText(err, …)` and stays.

- [ ] **Step 1: Write failing tests** (mock `../../lib/rpc`): unchanged name → no rename, `onDone` called; blank/whitespace/over-limit → error shown, no rename; changed name → one `rename({spaceId, name: "Alves Studio"})` and `onDone("Alves Studio")`; double click → one call; rejected rename → error visible, `onDone` not called.
- [ ] **Step 2: Run** `pnpm exec vitest run apps/web/src/pages/onboarding/WorkspaceStep.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement** with `Input` and `Button` from `@corvo/ui-web`.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** — "Add the workspace onboarding step".

### Task 5: Uso step

**Files:**
- Create: `apps/web/src/pages/onboarding/UseStep.tsx`
- Test: `apps/web/src/pages/onboarding/UseStep.test.tsx`

**Interfaces:**
- Produces: `UseStep(props: { onDone: (categories: StoreCategory[]) => void })`. A Personal / Work / Both toggle (reuse the `ToggleGroup` markup from `SignupSurvey.tsx`) and a multi-select card grid of `STORE_CATEGORIES` (each card is a `button` with `aria-pressed`, label from a Lingui map of the nine categories). Continue calls `rpc.onboarding.signupSurvey({ use })` fire-and-forget (a failure never blocks, same as `SignupSurvey`), then `onDone(picked)`. Nothing is required; Continue is always enabled.

- [ ] **Step 1: Write failing tests**: picking two categories then Continue calls `onDone(["sales","support"])` in grid order; chosen `use` is sent as `signupSurvey({ use: "work" })`; nothing picked → `signupSurvey({})` and `onDone([])`; a rejected `signupSurvey` still calls `onDone`; cards expose `aria-pressed`.
- [ ] **Step 2: Run** `pnpm exec vitest run apps/web/src/pages/onboarding/UseStep.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement**; remove nothing from `SignupSurvey.tsx` yet (Task 8 does).
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** — "Add the use onboarding step".

### Task 6: Primeiro bot step

**Files:**
- Create: `apps/web/src/pages/onboarding/FirstBotStep.tsx`
- Test: `apps/web/src/pages/onboarding/FirstBotStep.test.tsx`

**Interfaces:**
- Consumes: `orderTemplates` (Task 1); `createOrReuseFirstBot` from `apps/web/src/lib/first-bot.ts`; `addCatalogAgent(entry, locale, servers, installedSkillNames)` from `apps/web/src/lib/agent-catalog-install.ts`.
- Produces: `FirstBotStep(props: { locale: AgentCatalogLocale; categories: StoreCategory[]; onDone: (botId: string) => void; onSkip: (chiefId: string) => void })`. On mount it calls `createOrReuseFirstBot(locale)` once to make sure the Chief and team exist, then shows the gallery from `orderTemplates(AGENT_CATALOG.filter(e => !e.setup), categories)` (entries needing setup such as the email agent are excluded). One tap on a card selects it; the "Create bot" button calls `addCatalogAgent(entry, locale, [], [])` once (disabled while pending) and then `onDone(botId)`. A secondary "Skip" button calls `onSkip(chiefId)`. A failure keeps the selection and shows an error with a retry button. Bots made by the starter team that match the chosen slug are reused by `addCatalogAgent` through its spawn key.

- [ ] **Step 1: Write failing tests** (mock `rpc`, `first-bot`, `agent-catalog-install`): `createOrReuseFirstBot` called once on mount with the locale; with `categories=["sales"]` the first card is a sales entry; email agent not listed; select + Create calls `addCatalogAgent(<entry>, "pt-BR", [], [])` once even on double click and then `onDone("bot-1")`; rejection → error shown, selection kept, `onDone` not called, retry succeeds; Skip calls `onSkip("chief-1")` without `addCatalogAgent`.
- [ ] **Step 2: Run** `pnpm exec vitest run apps/web/src/pages/onboarding/FirstBotStep.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement.** Keep the module-level in-flight promise and Web Lock used by `ensureFirstBot` in `Onboarding.tsx:91-107` by moving `withFirstBotLock` and `ensureFirstBot` into `apps/web/src/lib/first-bot.ts` (export them, keep their behavior) and have both `Onboarding.tsx` and this step import them.
- [ ] **Step 4: Run** this test and `pnpm exec vitest run apps/web/src/lib/first-bot.test.ts` — expect PASS.
- [ ] **Step 5: Commit** — "Add the first bot onboarding step".

### Task 7: Computador step

**Files:**
- Create: `apps/web/src/pages/onboarding/ComputerStep.tsx`
- Test: `apps/web/src/pages/onboarding/ComputerStep.test.tsx`

**Interfaces:**
- Consumes: `chooseHostComputer` (Task 2), `desktopBridge()` from `apps/web/src/lib/desktop.ts`.
- Produces: `ComputerStep(props: { hostLabel: string; onDone: () => void })`. Two choices, Docker preselected (the conservative one), "this computer" second; reuse the exact existing copy from `HostComputerPrompt` so no new strings are needed. Continue calls `chooseHostComputer(desktopBridge(), choice)`; `false` (declined native prompt) stays on the step; `true` calls `onDone`; an error shows `errorText(err, …)`. No skip.

- [ ] **Step 1: Write failing tests**: Docker preselected; Continue with default calls `chooseHostComputer(_, "docker")` then `onDone`; choosing this computer and a `false` result does not call `onDone`; an error is shown and `onDone` not called; button disabled while pending.
- [ ] **Step 2: Run** `pnpm exec vitest run apps/web/src/pages/onboarding/ComputerStep.test.tsx` — expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** — "Add the computer onboarding step".

### Task 8: Wire the flow and remove the import entry

**Files:**
- Modify: `apps/web/src/pages/Onboarding.tsx` (step state machine; `goTo`, `createFirstBot`, the `survey` and `bot` render branches, `onFinished` of `useModelOAuthSignIn`)
- Delete: `apps/web/src/pages/onboarding-import.tsx`, `apps/web/src/lib/first-bot-import.ts`, `apps/web/src/lib/first-bot-import.test.ts`, `apps/web/e2e/onboarding-agent-import.spec.ts`; `apps/web/src/components/SignupSurvey.tsx` once nothing imports it
- Modify: `apps/web/e2e/onboarding-signup-survey.spec.ts`, `apps/web/e2e/onboarding-conversation.spec.ts`, `apps/web/e2e/onboarding-model-*.spec.ts` as needed
- Create: `apps/web/e2e/onboarding-flow.spec.ts`
- Modify: `apps/web/src/locales/*/messages.po` (via extract)

**Interfaces:**
- Consumes: everything from Tasks 1 to 7.
- Produces: `/onboarding/:step?` accepts `workspace | survey | model | bot | computer`; `/onboarding` resolves through `resolveStep`. On load it reads `rpc.me()` and `rpc.spaces.list()` to build `OnboardingContext` (`spaceName` and `canRenameSpace` from the current space in `spaces`, `hasDesktopHostChoice` from `desktopBridge()?.computer?.managesHostChoice`). Moving on always uses `nextStep`; `null` navigates to `/app/<botId>` of the chosen bot (or the Chief after Skip). Step 4 runs after model; the `done` set is built from steps passed through in the session plus steps already satisfied by `Me` (model) so the bar never counts a visit. The "Import an agent" link and everything that used `importing`, `importedBotRef`, `importedBotId`, `notImported`, `afterSurvey` and `surveyDone` is removed. `rpc.onboarding.promptFocus` is no longer called by onboarding (Uso replaces it); the API stays for mobile.

- [ ] **Step 1: Write failing e2e specs in `onboarding-flow.spec.ts`**: (a) a new user sees the sidebar with Workspace, Uso, Model (when needed), First bot, picks a sales template and lands on `/app/<id>` whose bot name is that template, and the Chief also exists in the bot list; (b) renaming the workspace shows the new name in the sidebar; (c) `/onboarding/computer` on web (no desktop) lands on a visible step; (d) reloading `/onboarding/bot` after creating one bot does not create a second Chief (`rpc.bots.list` filtered by `spawnKey` has length 1).
- [ ] **Step 2: Rewrite the state machine** in `Onboarding.tsx` with `resolveStep`, `nextStep` and `progress`, render `OnboardingLayout` around the new steps and the existing model step; keep the model step JSX as is, moving to `nextStep(ctx, "model")` where it called `goTo("bot")`.
- [ ] **Step 3: Remove the import entry** and delete the files listed above. `AgentImportForm` and `shell/agent-import` stay.
- [ ] **Step 4: Update the other onboarding e2e specs** that asserted the old survey heading or the automatic first-bot navigation (`onboarding-signup-survey`, `onboarding-conversation`, `onboarding-model-*`) so they follow the new steps; keep every behavior they protect (model required, auto-skip, labels).
- [ ] **Step 5: Extract strings** — `pnpm --filter @corvo/web intl:extract`, fill `pt-BR`, then `pnpm exec vitest run apps/web/src/lib/i18n-catalog.test.ts` — expect PASS.
- [ ] **Step 6: Verify** — `pnpm exec vitest run apps/web/src`, `pnpm lint`, `pnpm --filter @corvo/web build`, expect all pass. Do not run Playwright locally; open the dev server once (`pnpm dev`) and walk the flow by hand in light and dark mode, at a narrow width, and with the keyboard only. The new e2e specs run in CI.
- [ ] **Step 7: Commit** — "Guide new accounts through a five-step onboarding". The PR description must quote the new copy and link the CI e2e screenshot, per `AGENTS.md`.

## Self-review notes

- Spec coverage: five steps (Tasks 4 to 7), step logic and progress (1), computer rules and shared prompt choice (2, 7), Chief always created (6), import entry removed (8), no stored skipped state (none needed), resume and URL steps (1, 8). Spec's "analytics events" and "team step" are out of scope in the spec and have no task.
- Types: `OnboardingStepId`, `OnboardingContext`, `visibleSteps`, `nextStep`, `resolveStep`, `progress`, `orderTemplates`, `chooseHostComputer` are defined once (Tasks 1, 2) and used with the same names later.
