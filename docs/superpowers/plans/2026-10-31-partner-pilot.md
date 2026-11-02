# Partner pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A partner SaaS sends one of its customers to Corvo through a one-time link and the customer lands, already signed in, in its own isolated organization with agents the partner prepared, a connector to the partner's own system, and a monthly credit allowance the partner controls.

**Architecture:** A new server-to-server partner API (authenticated by a per-partner key) provisions a tenant (organization, space, one owner user, credit account, connector, starter agents) idempotently and mints a short-lived one-time entry URL. A public entry endpoint on the web origin consumes that code, creates a normal better-auth session for the tenant's owner user, and redirects into the app. The partner is the commercial authority: suspending a tenant blocks every path that starts a run. Isolation reuses the existing organization and row-security model; nothing about the runtime is split per tenant.

**Tech Stack:** Prisma and Postgres (row security), Hono routes in `apps/api`, better-auth (sessions), `packages/contracts` (zod), Vitest (offline, plus the existing Postgres test harness).

**Spec:** The long-term vision is `docs/superpowers/specs/2026-10-30-partner-embedded-agents-design.md` (Portuguese; draft, not part of this repository's tracked docs yet). **This plan implements only the pilot slice defined under "Pilot scope" below, and where the two differ the pilot scope wins.** The infrastructure sizing note is `docs/superpowers/specs/2026-10-30-partner-runtime-infrastructure.md`.

## Pilot scope

In:

- Partner registration and keys (script on the server, no UI).
- Idempotent tenant provisioning, suspend and resume.
- **One Corvo seat per tenant**: every person from the partner who opens "Minha equipe AI" for a company enters as that company's single owner user. Which partner user clicked is recorded for audit. Reason: today a bot belongs to one user inside a space (`listBots` filters by `spaceId` and `userId`), so staff sharing agents needs a shared-ownership model that is a separate, larger change.
- One MCP connector per tenant, authenticated by a per-tenant bearer token the partner's own system issued and passes at provisioning (the partner's server derives the tenant from that token).
- A fixed set of starter agents per tenant, created once and never overwritten.
- A monthly credit allowance per tenant, set by the partner, using the existing credit ledger.
- Entry through a one-time link that opens Corvo in the browser (no iframe, no SDK).
- Partner users see no Corvo billing, onboarding or paywall.

Out (later): iframe/SDK embed and branding tokens, hierarchical budgets (partner, company, agent, execution), shared agents between several users of a company, versioned agent templates and updates, outbound events and usage reports, per-tenant dedicated compute, a second partner.

## Global Constraints

- Public repository: no partner or customer names, keys, tokens, hostnames or real data in code, tests, docs or PR text. Use `acme-saas` style placeholders.
- Migrations only add tables and columns; the previous release must keep working next to the new one.
- Partner credentials and tenant connector tokens are stored hashed or sealed and never appear in logs, errors, responses (after creation) or the web app.
- Tests are deterministic and offline by default; anything needing Postgres uses the existing Postgres test harness.
- Every new visible word is quoted and justified in the PR and translated in English, Brazilian Portuguese and Spanish (the catalog test fails on a missing translation).
- Do not run the desktop Playwright suite locally.
- PR descriptions: Why, What, How tested. Open each PR against `main`, never stacked.

## Review Focus

The inputs the spec implies and the tests alone would not exercise, most likely to bite first:

1. **A suspended tenant still runs.** Every path that starts or continues a run must be blocked: interactive chat, a routine firing, a webhook, a queued job, a delegation, a run already queued before the suspension. Expected: none start; history stays readable.
2. **An entry code used twice or at the same instant.** Two requests with the same code must yield one session and one refusal; an expired or unknown code must say nothing about which.
3. **One partner's key on another partner's tenant.** Expected: the same answer as a tenant that does not exist.
4. **The synthetic owner's email colliding with a real Corvo account.** Expected: never links to it, never takes it over.
5. **Concurrent first provisioning of the same tenant.** Two simultaneous requests must produce one organization, one owner and one set of agents.

## Global design calls (mine, to confirm)

- The tenant owner's `User` gets a non-deliverable synthetic email derived from the partner and tenant ids, and `emailVerified` true. A partner customer's real email is stored on the entry audit row only, so it cannot collide with or take over a direct Corvo account.
- Entry codes are random, stored hashed, single use, valid for 60 seconds, bound to one tenant.
- Credit allowance is a normal credit grant with an expiry at the end of the period, with a source id derived from partner, tenant and period, so repeating the call in the same period changes nothing.
- A partner organization never needs a Corvo subscription: access comes from its credit balance, the existing rule in `hasModelAccess`.

---

### Task 1: Partner tables and migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<timestamp>_partner_pilot/migration.sql`
- Test: `packages/db/src/partner-schema.postgres.test.ts`

**Interfaces:**
- Produces models `Partner { id, slug unique, name, keyHash, keyPrefix unique, enabled, createdAt }`, `PartnerTenant { id, partnerId, externalTenantId, organizationId unique, ownerUserId, state ("enabled"|"suspended"), createdAt, updatedAt; unique(partnerId, externalTenantId) }`, `PartnerEntryCode { id, codeHash unique, partnerId, tenantId, externalUserId, externalEmail?, expiresAt, usedAt?, createdAt }`.

- [ ] **Step 1: Write the failing test.** Using the Postgres harness: the same `externalTenantId` can exist under two partners; under one partner it is unique; one organization maps to at most one tenant; a code hash is unique.
- [ ] **Step 2: Run it.** Expected: FAIL, the models do not exist.
- [ ] **Step 3: Add the models and an additive migration.** None of these tables get row security by space: they are platform tables read only by server code.
- [ ] **Step 4: Run it.** Expected: PASS, and `prisma generate` and the type check still pass.
- [ ] **Step 5: Commit.**

### Task 2: Partner keys and the script that creates them

**Files:**
- Create: `packages/core/src/partner-key.ts`, `packages/core/src/partner-key.test.ts`
- Create: `apps/api/src/cli/partner.ts`; add it to `apps/api/package.json` scripts and to the `build` entry list
- Test: `apps/api/src/cli/partner.test.ts`

**Interfaces:**
- Produces `generatePartnerKey(): { key: string; prefix: string; hash: string }`, `hashPartnerKey(key: string): string`, `verifyPartnerKey(key: string, storedHash: string): boolean` (constant time). The key has a recognizable prefix and enough entropy; only prefix and hash are stored.
- The script: `partner create <slug> <name>` prints the key once; `partner rotate <slug>`; `partner disable <slug>`.

- [ ] **Step 1: Write failing tests.** A generated key verifies; a wrong key and a key of a different length do not; the hash is deterministic and never equals the key; the prefix finds the row without revealing the key; rotating invalidates the old key at once; a disabled partner never verifies.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the three functions in core and the script over them, following the existing `bootstrap-owner.ts` CLI pattern for env and database access.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 3: Tenant provisioning, suspension and the access gate

**Files:**
- Create: `packages/db/src/partner-tenants.ts`, `packages/db/src/partner-tenants.postgres.test.ts`
- Modify: `packages/db/src/billing.ts` (`spaceHasModelAccess`), `packages/db/src/index.ts`

**Interfaces:**
- Consumes the pattern of `bootstrapUserSpace` (organization, member, space with the organization's id, space member, memory document, notification preferences).
- Produces `provisionPartnerTenant(prisma, partner: { id }, input: { externalTenantId: string; name: string }): Promise<{ tenantId: string; organizationId: string; spaceId: string; ownerUserId: string; created: boolean }>`, `setPartnerTenantState(prisma, partnerId, externalTenantId, "enabled" | "suspended"): Promise<void>`, `findPartnerTenant(prisma, partnerId, externalTenantId)`.
- `spaceHasModelAccess` additionally returns false when the space's organization is a partner tenant in the `suspended` state.

- [ ] **Step 1: Write failing tests (Postgres).** Provisioning twice returns the same ids with `created` false the second time; two simultaneous calls give one organization, one owner and one space; two partners with the same `externalTenantId` get different organizations; the owner's synthetic email is unique and non-deliverable; suspending makes `spaceHasModelAccess` false even with credits, resuming restores it; an unknown tenant under another partner's id is not found.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with the same win-or-join-the-winner handling of unique violations that `bootstrapUserSpace` uses, and the gate change in `spaceHasModelAccess`.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 4: Connector and starter agents

**Files:**
- Create: `apps/api/src/partner-content.ts`, `apps/api/src/partner-content.test.ts`

**Interfaces:**
- Consumes `createBot(actor, input)` with `spawnKey`, the secret store, and the `botMcpServer.upsert` pattern in `apps/api/src/email-agent.ts` (`installEmailAgent`).
- Produces `installPartnerTenantContent(deps, actor, content: { connector?: { slug: string; name: string; endpoint: string; token: string }; agents: Array<{ key: string; name: string; instructions: string; usesConnector: boolean }> }): Promise<{ botIds: Record<string, string> }>`.

- [ ] **Step 1: Write failing tests.** Calling twice creates one connector and one bot per agent key (spawn key `partner:<partnerId>:<key>`); a second call with a new token rotates the stored secret and does not touch the agents' instructions, name or memory; the connector endpoint must be an allowed MCP endpoint under the existing network policy (a private address is refused); the token is never returned, logged or placed in an error; an agent that does not use the connector gets no assignment.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** reusing the existing MCP server creation path so health, discovery and the network policy apply, and assigning the server to each agent that uses it with all tools allowed.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 5: Monthly allowance

**Files:**
- Create: `packages/db/src/partner-allowance.ts`, `packages/db/src/partner-allowance.postgres.test.ts`

**Interfaces:**
- Consumes `reconcileCreditPurchase(prisma, organizationId, { id, amountCents, expiresAt })`.
- Produces `grantPartnerAllowance(prisma, tenant: { organizationId: string; partnerId: string; externalTenantId: string }, input: { amountCents: number; period: string }): Promise<{ addedCents: number }>` where `period` is a `YYYY-MM` string and the grant expires at the end of that month in UTC.

- [ ] **Step 1: Write failing tests (Postgres).** Granting twice in one period adds once; a new period adds a new grant; raising the amount in the same period adds only the difference, lowering never takes credit back; an expired grant no longer counts; a tenant can then start a run only while a balance remains.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** as a thin wrapper that derives the grant id from partner, tenant and period.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 6: Partner API routes and contracts

**Files:**
- Create: `packages/contracts/src/partner.ts`, `apps/api/src/partner-routes.ts`, `apps/api/src/partner-routes.test.ts`
- Modify: `packages/contracts/src/index.ts`, `apps/api/src/app.ts` (mount the routes)

**Interfaces:**
- Consumes tasks 2 to 5.
- Produces `PUT /api/partner/v1/tenants/:externalTenantId` with body `{ name, state?: "enabled" | "suspended", connector?, agents?, allowanceCents?, period? }` returning `{ tenantId, created }`; `POST /api/partner/v1/tenants/:externalTenantId/suspend` and `/resume`; `POST /api/partner/v1/sessions` with `{ externalTenantId, externalUserId, email? }` returning `{ url, expiresAt }`. Authentication: `Authorization: Bearer <partner key>`; responses for an unknown tenant and another partner's tenant are identical.

- [ ] **Step 1: Write failing tests.** A request with no key, a wrong key, a disabled partner's key or a key of the wrong length is refused the same way; the body size is bounded; a valid `PUT` provisions everything and a repeat changes nothing; `PUT` with `state: "suspended"` suspends; a session request for a suspended or unknown tenant is refused without creating anything; a session request returns a URL on the web origin whose code is hashed in storage and expires in 60 seconds; requests are rate limited per partner.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the routes as thin handlers over the services, with the contracts shared and strict (unknown fields rejected). Record `externalUserId` and the optional email on the entry code row.
- [ ] **Step 4: Run.** Expected: PASS, plus the API type check.
- [ ] **Step 5: Commit.**

### Task 7: Entry endpoint

**Files:**
- Create: `apps/api/src/partner-entry.ts`, `apps/api/src/partner-entry.test.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Produces `GET /api/partner/enter?code=...`: consumes the code atomically, refuses if expired, used, unknown or the tenant is suspended, creates a session for the tenant's owner user through better-auth's session machinery (so the existing session hooks, cookie attributes and security events apply), and redirects to the app with that tenant's space selected. Every refusal is the same page and status.

- [ ] **Step 1: Write failing tests.** A valid code creates one session and redirects; a second use of the same code, and two simultaneous uses, give exactly one session; an expired code and a made-up code are indistinguishable; a code for a tenant suspended after minting is refused; the cookie is `HttpOnly`, `Secure` where the deployment is HTTPS, and `SameSite=Lax`; the code never appears in the redirect URL, logs or the security event metadata; the session's security event records that it came through a partner.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with a single conditional update that marks the code used and returns the row, so racing requests cannot both win.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 8: What a partner customer sees

**Files:**
- Modify: `packages/contracts/src/domain.ts` (`Me` gains `partner: { name: string } | null`), `apps/api/src/routes/shared.ts`, `apps/web/src/pages/Onboarding.tsx` and the places that read `billingEnabled`/`needsSignupSurvey`, the settings navigation
- Test: the matching existing test files plus one new web test

**Interfaces:**
- `me.partner` is non-null only for a partner tenant's owner user. When set: `billingEnabled` is false, `needsSignupSurvey` is false, onboarding is considered done, the Billing section of settings and the paywall are absent, and no Corvo starter team is created.

- [ ] **Step 1: Write failing tests.** For a partner user the server returns the flags above; the web shell does not render the paywall, the survey, the onboarding or the Billing section; an ordinary user is unchanged.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** No new visible words: this only removes screens.
- [ ] **Step 4: Run.** Expected: PASS, with the whole web suite and type checks.
- [ ] **Step 5: Commit.**

### Task 9: Gate every way a run starts

**Files:**
- Modify: whichever run entry points do not already pass through `spaceHasModelAccess`
- Test: `packages/testkit` or `apps/api` integration test covering each path

**Interfaces:**
- Consumes the gate from task 3.

- [ ] **Step 1: List the paths.** Search for every producer of a run (interactive message, routine tick, webhook and messaging inbound, delegation and handoff, retries and queued-job claim) and record each in the PR with the gate it passes through.
- [ ] **Step 2: Write failing tests** for each path that does not yet check the suspended state: with a suspended tenant the path creates no run, or claims no queued job, and a run queued before the suspension is not started.
- [ ] **Step 3: Run.** Expected: FAIL for the unguarded paths.
- [ ] **Step 4: Add the check** at the narrowest shared point instead of at each caller where one exists.
- [ ] **Step 5: Run.** Expected: PASS, and the existing billing gate tests unchanged.
- [ ] **Step 6: Commit.**

### Task 10: Isolation tests across partners and tenants

**Files:**
- Create: `packages/db/src/partner-isolation.postgres.test.ts`

- [ ] **Step 1: Write the tests (Postgres).** With two partners and three tenants: a tenant's owner cannot read another tenant's bots, threads, memory, MCP servers, secrets, routines or credit entries through the repositories; partner A's key cannot provision, read, suspend or mint a session for partner B's tenant; the connector token stored for one tenant is not readable by another tenant's actor; deleting a tenant's content leaves the others untouched.
- [ ] **Step 2: Run.** Expected: PASS. A failure here is a security finding to fix before anything else ships.
- [ ] **Step 3: Commit.**

### Task 11: A fake partner and the operator guide

**Files:**
- Create: `apps/api/src/cli/partner-demo.ts` (or a script under `packages/testkit`), `docs/partner-pilot.md`

- [ ] **Step 1: Write the demo script.** It stands in for the partner's server: reads the key from the environment, provisions a tenant with a sample connector endpoint and two agents, grants an allowance, requests a session and prints the entry URL.
- [ ] **Step 2: Write `docs/partner-pilot.md`.** The three calls with placeholder hosts, what the partner's backend must implement (a button, one route, a connector token per tenant), how to create and rotate the key, how to suspend, and what the pilot deliberately does not do.
- [ ] **Step 3: Run the demo end to end against a local stack** and open the printed URL in a browser: expect to land signed in, with the agents present, no onboarding, no billing screen.
- [ ] **Step 4: Commit.**

## Order and rough effort

Tasks 1 to 3 are the foundation and come first (about a week). Tasks 4 and 5 can then be done in either order (about a week). Task 6 and 7 (about a week). Tasks 8 to 10 close the loop and are where the security review happens (about a week). Task 11 is the day or two that makes it testable. A realistic range for the whole pilot is four to six weeks; the largest uncertainty is the partner's own MCP server, which is not part of this plan.

## Self-review notes

- Spec coverage: identity and tenancy (1, 3), partner authority and suspension (3, 9), MCP connector and starter agents (4), allowance (5), session and entry (6, 7), partner experience (8), isolation (10). Deliberately absent: embed, budgets, events, shared agents, versions, second partner (see Pilot scope).
- Type consistency: `PartnerTenant.ownerUserId` is the user task 7 signs in; `provisionPartnerTenant` returns it for task 4's actor; the grant id derives from `partnerId`, `externalTenantId` and `period` in task 5 and nowhere else.
