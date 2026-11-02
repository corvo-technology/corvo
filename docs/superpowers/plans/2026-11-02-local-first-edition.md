# Local-first edition and open-source launch plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development. One pull request per phase, each against `main`, never stacked.

**Goal:** The free, open-source Corvo runs entirely on the person's computer with no account and no cloud call, on macOS, Windows and Linux, and installs with one command. The hosted edition keeps accounts, credits and partners.

**Architecture:** The desktop app already starts its own engine (embedded Postgres, API, worker) and the web UI. This plan removes the engine's dependency on the hosted sign-in, adds the database binaries for the other systems, makes the local edition show only bring-your-own-key and local models, and publishes installers from a public releases repository.

**Tech stack:** Electron, Better Auth plugins (`packages/auth`), Hono API (`apps/api`), `@embedded-postgres/*`, electron-builder, shell and PowerShell installers.

## Editions

| | Local (desktop, free) | Self-hosted server (a team) | Cloud (hosted) |
|---|---|---|---|
| Sign-in | none: a local owner is entered automatically | email and password, stored on that server | email code through the hosted account service |
| Models | own key, local models | own key, local models | credits (OpenRouter) or own key |
| Billing, partners | hidden | hidden | on |
| Data | this computer only | that server | hosted |

Nothing about the local edition leaves the computer unless the person adds a model key or a connector.

## Global constraints
- Public repository: no secrets, local paths, customer names or business figures in code, docs, commits or PR text.
- Migrations additive only. Tests deterministic and offline. Do not run the desktop Playwright suite locally.
- Every new visible word is UI: quote it in the PR and justify it.
- The automatic local owner must be impossible to turn on outside the desktop-started engine.

## Phase 1: Local owner without sign-in
- Add `localEntry` to `packages/auth` (a Better Auth plugin like `partner-entry.ts`): `GET /local/enter`, refuses unless a constant-time match of the desktop stack token, then finds the engine's one real user (oldest non-partner user, so an existing local install keeps its data) or creates the local owner, opens a normal session through the shared session machinery, sets the cookie, redirects to `/app`. Same answer for every refusal.
- `apps/api/src/env.ts`: `desktopStackToken` already exists; enable the plugin only when it is set. Keep `/local/enter` closed to the public auth handler (`isBlockedAuthPath`) and mount it from `app.ts` like the partner entry.
- `apps/desktop/src/embedded-engine.ts`: stop passing `CORVO_CENTRAL_AUTH_URL`. The engine no longer needs the hosted account service.
- `apps/desktop/src/main.ts`: the main process calls the entry with the token (header, never a URL) before loading the window and installs the cookie; on a lost session it enters again.
- Make the session long enough that a lost cookie is rare; sign-out in the local edition is hidden.
- Tests: wrong or missing token refused; no token configured means the route does not exist; existing single user is reused; second call reuses the session owner; the route is not reachable through `/api/auth/*`.
- Open point to verify first: how the first space and the Chief are created on user creation, so the local owner arrives with the same starting state as anyone else.

## Phase 2: Self-hosted server sign-in
- With no `CORVO_CENTRAL_AUTH_URL`, sign-in is email and password on the server itself. Check that sign-up works without an email provider (no verification mail required), that the first account becomes the owner, and that a password reset degrades with a clear message when no mail is configured.
- Document the environment a self-hosted server needs (`docs/self-hosting.md`): what is optional, and that nothing is sent outside.
- Tests around the env combinations: central URL unset and password auth on; central URL set (cloud) unchanged.

## Phase 3: Embedded Postgres for Windows and Linux
- `apps/desktop/package.json`: add `@embedded-postgres/windows-x64`, `linux-x64`, `linux-arm64` (same version as macOS, all published) as optional dependencies, copy the right one into `extraResources` per platform build, and exclude the others.
- `apps/desktop/src/embedded-engine.ts` `engineResourcePaths`: choose the folder from the platform and architecture (`.exe` suffix on Windows), instead of the fixed `darwin-arm64` path.
- Check `initdb` flags that differ per system (`--locale`, `en_US.UTF-8` is not present on every Linux and does not exist on Windows) and fall back to a locale that exists.
- Check the Windows engine: file locking, process stop, loopback port, paths with spaces.
- Tests: path resolution for every platform and architecture; `initdb` arguments per platform.
- Verification that cannot run here: a real install and first launch on Windows, Ubuntu x64 and ARM64. Ask the maintainer for a machine or a virtual machine for each, or run it in CI on those runners.

## Phase 4: Local edition shows only what applies
- Sweep every message that sends the person to billing or credits ("Subscribe in Billing", "Connect a model to start a run", credit meters) and make the local edition say what it can do: add an own key or a local model.
- Hide Billing, Partnership, plans and paywall in the local and self-hosted editions (already gated by configuration; add tests that prove it with the local environment).
- Show the model setup as the first step when no model is connected.
- Check the context meter, usage page and store entries for cloud-only wording.

## Phase 5: Computers for agents without Docker
- Local edition runs with `SANDBOX_PROVIDER=none` and agents use "this computer". Decide and write down what a person sees when they want an isolated computer: offer Docker when it is installed, otherwise explain in one line.
- Review what an agent may touch on the person's own computer by default (folders, shell, browser) and make the default the safest one with an explicit grant.

## Phase 6: Public releases and one-line install
- Create a public releases-only repository for installers and the install scripts; the source repository stays as is. Point `publish` in `apps/desktop/package.json` and the scripts' base URL at it (auto-update needs public assets too).
- Add the Linux `.deb` next to the AppImage (Ubuntu 24.04 needs the AppArmor profile the `.deb` installs).
- Stable installer names and the install scripts are open in the existing pull request; merge it first.
- A short page with the three commands (macOS and Linux, Windows) and the system requirements.
- Because GitHub Actions is disabled, write the manual release steps (build per system, sign, notarize, upload) and re-enable only the desktop release workflow when the maintainer decides.

## Phase 7: Open-source readiness
- License and trademark notes, a contributing guide, a security policy, issue templates.
- Public-repo audit: search history and docs for secrets, personal data, customer names, local paths and business figures; rotate anything that ever leaked.
- Remove or generalize references that only make sense for the hosted business.
- Decide which of the specs under `docs/superpowers/specs` are published.

## Review focus (inputs the phases above must not break)
- An existing local install with a hosted-account user must keep every conversation after Phase 1.
- A person with no internet connection must reach the app and chat with a local model.
- A person who opens the local web address in a normal browser must not get a signed-in session.
- A path with spaces or non-ASCII characters in the user's name must not break the engine on Windows.
- A second app instance, or a crash during `initdb`, must leave a state the next launch repairs.

## Order and size
Phases 1 and 3 are the blockers and independent; do them first. Phase 2 and 4 follow. Phase 6 needs the maintainer's decisions (the public repository, certificates). Phase 7 is the last gate before opening the code.

## Decisions needed from the maintainer
1. The name of the public releases repository.
2. Apple, Windows and Linux machines (or CI runners) to test installs.
3. A Windows signing certificate, or accept the unsigned installer warning for the first release.
