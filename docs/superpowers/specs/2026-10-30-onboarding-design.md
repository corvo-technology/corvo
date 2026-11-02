# Onboarding evolution design

## Intent

A new account should reach a real conversation with a bot that fits its work in as few steps as possible. Today onboarding is a survey, a model connection and an automatic Chief; the person never chooses what the first bot is for. This design turns it into a short guided flow with a sidebar and progress, so a new user ends in a real chat with a bot picked for their use.

## Goals

- A five-step flow on web and Electron (Electron hosts the web UI): Workspace, Uso (use), Modelo (model), Primeiro bot (first bot), Computador (computer, local stack only). Finishing opens the chosen bot's chat.
- Removing the "Import an agent" entry from onboarding. The import itself stays in the app shell.
- Progress derived from real state, never from visits. Steps are `completed`, `skipped`, `pending` or `active`.
- Resume after closing the app, with no duplicated Space or bot.
- Existing accounts and the existing onboarding routes (`/onboarding`, `/onboarding/survey`, `/onboarding/model`) keep working; no account that finished onboarding sees it again.
- Reuse what exists: `spaces.rename`, `SignupSurvey`, the model connection steps in `Onboarding.tsx`, `AGENT_CATALOG`, `agentCatalogSpawnKey`, `HostComputerPrompt`, `AgentImportForm` stays where it is.

## Non-goals

- Agent import in onboarding (decided: not now). The import code stays reachable from the app.
- Team and invitations: there is no email invite flow in the app today (only the better-auth organization plugin, unused by UI). The step is cut, not faked.
- One-click migration of bots from a local server to a hosted one, stopping the local stack afterwards. Wanted, but nothing in the code moves bots between servers today, so it is its own project with its own design. Onboarding only keeps the computer choice skippable and reachable later so this does not block it.
- A talking assistant character (the reference's Theo) and explanatory copy. `AGENTS.md` asks for minimal copy and progressive disclosure.
- A new onboarding table. State must come from the real entities (see Persistence).
- Mobile (Expo) onboarding. Out of scope for this pass; the API changes must not break it.

## Anti-goals (a failure even if it technically works)

- Creating a second Space or duplicate bots when the flow is reopened or a step is retried.
- A step that looks done but only because it was visited, or a button that does nothing.
- Hardcoded colors, new copy that is not justified in the PR, vendor-specific provider code.

## Flow

| # | Step | Behavior | Reuses |
|---|------|----------|--------|
| 1 | Workspace | Rename the existing default Space. Name only. | `spaces.rename` |
| 2 | Uso | Personal / work / both plus what they want to automate. Answers only reorder templates and never connect anything. | `SignupSurvey`, `onboarding.signupSurvey` |
| 3 | Modelo | Existing provider, sign-in, key or Corvo credits. Skipped automatically when `needsModel` is false. | Model steps in `Onboarding.tsx`, `rpc.models.*` |
| 4 | Primeiro bot | Chief and starter team are created as always. The gallery from `AGENT_CATALOG`, ordered by step 2, adds the bot the person chooses. One tap creates it; "Personalizar" is optional. | `ensureTeam`, `AGENT_CATALOG`, `agentCatalogSpawnKey` |
| 5 | Computador | Local stack only: Docker (default) or this Mac. Hidden on hosted servers. Not skippable: the Shell already forces this choice in a required dialog (`HostComputerPrompt`), so this step asks it earlier, once. See "Computer step". | `HostComputerPrompt`, `me.computerHost`, `me.canChooseHostComputer` |
| — | Pronto | Not a screen: finishing step 4 (or 5) opens the chosen bot's chat. The sidebar lists steps 1 to 5 only. | Existing bot thread |

The sidebar lists the steps with a progress bar. Monochrome using `@corvo/ui-tokens`; the bots carry the only color. Built with `packages/ui-web` (shadcn on Base UI) and `apps/web/src/components/ai/` where an AI moment is needed.

## Persistence and resume

No `workspace_onboarding` table. Each step's completion is derived from the entity that proves it:

- Workspace: the Space name differs from the default placeholder, or the user confirmed it.
- Uso: a `SignupSurvey` row exists (an empty row means skipped, as today).
- Modelo: `needsModel` is false.
- Primeiro bot: a bot with the template's spawn key exists.
- Computador: `me.computerHost` is set, or the step was skipped.

Nothing is stored for "skipped". The app redirects to `/onboarding` only while no bot exists anywhere, and step 4 creates one, so after step 4 onboarding is never re-entered on its own. Opening `/onboarding/<step>` by URL shows that step, and `/onboarding` opens the first step not yet complete. No migration is needed. The categories picked in step 2 only order templates in the same session and are not stored; the answer to "how will you use Corvo" is stored through the existing survey RPC.

## Idempotency

Bot creation uses the catalog spawn key, so a double tap, a second tab or a retry returns the existing bot. The existing `withFirstBotLock` and `firstBotEnsure` pattern is the model for this.

## The Chief (decided)

The Chief and its starter team (`ensureTeam`) are always created: the Chief coordinates the other bots (`packages/db/src/starter-team.ts`, `packages/core/src/chief-agent.ts`). Onboarding does not change that. `ensureTeam` runs for every new account, idempotently, and the bot chosen in step 4 is created in addition to it. If the person picks a template that the starter team already contains, the existing bot is reused instead of creating a duplicate (same catalog spawn key).

Step 6 opens the chosen bot's chat. This is my call; the Chief stays one tap away in the bot list.

## Computer step (step 5)

The computer choice belongs to the server, not the account. `canChooseHostComputer` is true only when `SANDBOX_PROVIDER=docker` and the desktop host choice is enabled, i.e. the local stack run by the Electron app. The saved choice (`docker` or `this-mac`) lives in `DeploymentSettings`, and `this-mac` needs native confirmation (`desktop.computer.requestAccess()`), revocable later.

Cases:

| Server | Step 5 |
|--------|--------|
| Local stack, `canChooseHostComputer` and `computerHost` unset | Shown. Isolated Docker computer is the default and conservative option; "this Mac" asks for native confirmation. |
| Local stack, choice already made | Marked completed; no repeat. |
| Hosted or remote provider (e.g. Corvo Cloud, E2B), or no computers | Hidden. Nothing for the person to choose. |

Because a person can start on a local server and move to a hosted one later, the choice must not be treated as part of the account. Skipping is always safe, and the choice stays reachable after onboarding through the existing desktop menu entry (`desktop.computer.onConfigure`). While the onboarding screen is open, the existing `HostComputerPrompt` dialog is suppressed so the same question is not asked twice.

Moving from a local to a hosted server is a different server with its own account and data. Nothing here promises that bots, memory or the computer carry over.

## Testing

- Unit: step completion and resume, template ordering by survey answers, idempotent first-bot creation, skipped-step storage.
- Web: existing `apps/web/e2e/onboarding-*.spec.ts` keep passing; add specs for the new sidebar flow and a returning user. Per `AGENTS.md`, the PR must link the CI E2E screenshot, and Playwright for desktop is not run locally.
- Deterministic and offline: no model or network calls.

## Left to the builder

Exact visual details within the tokens, the shape of the skipped-step field, step transitions, i18n strings (en and pt-BR through Lingui), and the breakpoints for a compact sidebar.
