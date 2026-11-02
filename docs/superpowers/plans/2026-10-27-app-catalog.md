# Built-in App Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a curated, offline catalog of ready-to-connect MCP apps and an OpenBot-style Integrations grid on web, desktop and mobile.

**Architecture:** A zod schema in `packages/contracts` and typed data plus pure helpers in `packages/core` describe each app. Clients turn an entry into a `McpServerConfigInput` with one shared function and send it through the existing `mcp.servers.create` RPC (the backend still validates it), then run the existing `mcp.oauth.begin` flow. No backend or database change.

**Tech Stack:** TypeScript, zod, vitest, React + Lingui + shadcn/Base UI (web/desktop), Expo (mobile), Playwright (CI-only e2e).

**Spec:** `docs/superpowers/specs/2026-10-27-app-catalog-design.md`

## Global Constraints

- Public repo: no secrets, no private URLs, no real data; entries use only public vendor MCP URLs and public icon URLs.
- Top-level `import type`, never inline type imports; no dynamic `import()` unless deferred loading is needed.
- Colors only from `@corvo/ui-tokens` semantic tokens; web uses vendored shadcn components in `packages/ui-web`; mobile uses native controls (Expo UI, native sheets/menus) per AGENTS.md.
- Every visible word is UI: cards show name + one line; example prompts appear only after an app is connected. The PR description must quote the new copy and justify it.
- Vendor logic only in catalog data; no provider-specific env vars or code paths.
- Tests deterministic and offline; the endpoint probe script is opt-in and not part of `pnpm test`.
- No migrations (no DB change).
- Do not run the desktop Playwright suite locally.

## Review Focus

- Same app added twice (slug collision with an existing MCP server): show "Added", never create a duplicate.
- OAuth popup blocked, closed or timed out after the server was created: the app stays listed as added with a "Sign in" action, not a silent dead entry.
- Key-auth entry submitted with an empty or whitespace key: rejected before any RPC call.
- Icon URL fails to load: fall back to the app's initial, no broken image.
- Search with no match, or a category with no apps: no empty grid chrome beyond the existing "No apps match your search." copy.
- An MCP server the person added by hand with the same endpoint as a catalog entry: card shows "Added" too.

---

### Task 1: Catalog schema, config conversion and filters

**Files:**
- Create: `packages/contracts/src/app-catalog.ts`
- Modify: `packages/contracts/src/index.ts` (export it)
- Create: `packages/core/src/app-catalog.ts`
- Modify: `packages/core/src/index.ts` (export it)
- Test: `packages/core/src/app-catalog.test.ts`

**Interfaces:**
- Produces (contracts): `AppCatalogEntrySchema`, `type AppCatalogEntry = { slug: string; name: string; tagline: string; category: AppCategory; iconUrl: string; featured: boolean; endpoint: string; transport: "streamable_http" | "sse"; auth: { kind: "oauth" } | { kind: "key"; header: string; scheme: "bearer" | "raw"; label: string; hint: string; docsUrl: string }; prompts: string[] }`, `APP_CATEGORIES = ["coding","productivity","data","design","automation"] as const`, `type AppCategory`.
- Produces (core): `appCatalogToMcpConfig(entry: AppCatalogEntry, key?: string): McpServerConfigInput` (throws `Error("Key required")` when auth is `key` and `key` is blank after trim), `filterAppCatalog(entries: readonly AppCatalogEntry[], opts: { query: string; category: AppCategory | null }): AppCatalogEntry[]` (case-insensitive match on name and tagline; featured entries first, then alphabetical), `matchAddedServer(entry: AppCatalogEntry, servers: readonly McpServer[]): McpServer | undefined` (match on `slug` or on identical endpoint).

- [ ] **Step 1: Write failing tests** in `app-catalog.test.ts`: `converts an oauth entry without secret or headers`; `converts a key entry into a bearer Authorization header value via secret and a raw header via headers`; `rejects a blank key`; `filter puts featured first and matches tagline case-insensitively`; `filter by category excludes others`; `matchAddedServer matches by slug and by endpoint`.
- [ ] **Step 2: Run** `pnpm exec vitest run packages/core/src/app-catalog.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** the schema (https-only `endpoint`/`iconUrl`/`docsUrl`, `prompts` max 3, `slug` same regex as `McpServerBaseInput`) and the three functions. Conversion output must pass `McpServerConfigInput.parse`; look at how `McpServersOverlay.tsx` maps a bearer/header credential to `secret`/`headers` and mirror it exactly.
- [ ] **Step 4: Run** the test file and `pnpm exec tsc --noEmit -p packages/core` → PASS.
- [ ] **Step 5: Commit** `git add packages/contracts packages/core && git commit -m "Add the app catalog schema and helpers"`.

### Task 2: Catalog data and conformance test

**Files:**
- Create: `packages/core/src/app-catalog-data.ts` exporting `APP_CATALOG: readonly AppCatalogEntry[]`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/app-catalog-data.test.ts`

**Interfaces:**
- Consumes: Task 1 schema and `appCatalogToMcpConfig`.
- Produces: `APP_CATALOG`.

- [ ] **Step 1: Write failing conformance test** `every entry parses, has a unique slug, converts to a valid McpServerConfigInput, and has https urls`; `featured entries are between 4 and 8`; `every category in use is in APP_CATEGORIES`.
- [ ] **Step 2: Run** the file → FAIL.
- [ ] **Step 3: Fill `APP_CATALOG`** starting from the OpenBot list in the spec. Per entry take the endpoint and auth style from OpenBot's bundled manifests at `/Applications/OpenBot.app/Contents/Resources/plugin-catalog/<slug>/*.json` (`apps[0].server`), but write the tagline and prompts yourself in plain English; skip `cobrain`, `aave`, `apple-apps` and any entry whose auth needs a pre-registered OAuth client. Mark 4-8 well-known apps `featured` (e.g. Notion, Linear, Stripe, Sentry, Supabase, Figma).
- [ ] **Step 4: Run** the file → PASS.
- [ ] **Step 5: Commit** `Add the built-in app catalog data`.

### Task 3: Opt-in endpoint probe

**Files:**
- Create: `scripts/probe-app-catalog.ts` (run with `pnpm exec tsx scripts/probe-app-catalog.ts`)
- Test: none (network, opt-in; keep it out of `pnpm test`)

**Interfaces:**
- Consumes: `APP_CATALOG`.

- [ ] **Step 1: Write the script**: for each entry, POST a JSON-RPC `initialize` to `endpoint` with a 5 s timeout and print `slug: ok (200)`, `slug: needs-auth (401 + WWW-Authenticate)` or `slug: FAIL (<reason>)`; exit code 1 if any FAIL. Treat a 401 with `WWW-Authenticate` as healthy for OAuth entries.
- [ ] **Step 2: Run it once**; delete from `APP_CATALOG` every entry that FAILs and re-run Task 2's test.
- [ ] **Step 3: Commit** `Add an opt-in probe for catalog endpoints`.

### Task 4: Connect flow helper (web)

**Files:**
- Create: `apps/web/src/lib/app-catalog-connect.ts`
- Test: `apps/web/src/lib/app-catalog-connect.test.ts`

**Interfaces:**
- Consumes: `appCatalogToMcpConfig`, `matchAddedServer`, `rpc.mcp.servers.create`, `connectMcpOauth` from `./mcp-connect`.
- Produces: `connectCatalogApp(entry: AppCatalogEntry, opts: { key?: string; existing?: McpServer }): Promise<{ server: McpServer; oauth: McpOauthResult | null }>` — reuses `existing` instead of creating; runs `connectMcpOauth(server.id)` only for oauth entries; returns `oauth: null` for key entries.

- [ ] **Step 1: Write failing tests** with `rpc` and `connectMcpOauth` mocked: `creates the server then starts oauth for an oauth entry`; `reuses an existing server and does not call create`; `a key entry never starts oauth`; `a blank key throws before any rpc call`; `a cancelled oauth still returns the created server`.
- [ ] **Step 2: Run** `pnpm exec vitest run apps/web/src/lib/app-catalog-connect.test.ts` → FAIL.
- [ ] **Step 3: Implement** `connectCatalogApp`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `Add the catalog connect flow for web`.

### Task 5: Integrations grid (web and desktop)

**Files:**
- Create: `apps/web/src/pages/AppCatalogGrid.tsx` (grid, category filter, detail view; keeps `PluginsOverlay.tsx` from growing)
- Modify: `apps/web/src/pages/PluginsOverlay.tsx` (render `AppCatalogGrid` above the existing connector catalog; the empty-catalog copy "Configure a plugin catalog on the server to connect apps." must no longer show when `APP_CATALOG` has entries)
- Test: `apps/web/src/pages/AppCatalogGrid.test.tsx`

**Interfaces:**
- Consumes: `APP_CATALOG`, `filterAppCatalog`, `matchAddedServer`, `connectCatalogApp`, the overlay's `query`, `mcpServers` and `onUsePrompt`.
- Produces: `<AppCatalogGrid query={string} servers={McpServer[]} onUsePrompt={(text: string) => void} onChanged={() => void} />`. Tiles use `data-testid="app-tile-<slug>"`.

- [ ] **Step 1: Write failing component tests**: `renders featured entries first`; `category chip filters the grid`; `Add on an oauth app calls connectCatalogApp and shows Added`; `a key app shows the key field and docs link before Add`; `an added app shows its example prompts and clicking one calls onUsePrompt`; `a failed icon falls back to the initial`; `a created server with cancelled oauth shows Sign in`.
- [ ] **Step 2: Run** `pnpm exec vitest run apps/web/src/pages/AppCatalogGrid.test.tsx` → FAIL.
- [ ] **Step 3: Implement** the component with the existing shadcn `Button`, tile styling copied from `renderCatalogTile` in `PluginsOverlay.tsx`, and a detail view using the same back-arrow pattern. Wire `onUsePrompt` to the existing way the web app puts text into the active bot's composer (find it from `use-composer-mentions.ts` and the composer component; if none exists, send the text as a normal message to `activeBotId`).
- [ ] **Step 4: Run** the component tests and `pnpm --filter @corvo/web lint` and typecheck → PASS.
- [ ] **Step 5: Extract locales**: run the repo's Lingui extract script (see `apps/web/package.json`), and translate new strings in `pt-BR`.
- [ ] **Step 6: Commit** `Show the built-in app catalog in Integrations`.

### Task 6: E2E screenshot test

**Files:**
- Create: `apps/web/e2e/app-catalog.spec.ts`

- [ ] **Step 1: Write the spec** following `apps/web/e2e/app-connect-card.spec.ts`: open Integrations, expect `app-tile-notion` visible, search "linear" shows only Linear, open a detail view, take the screenshot the PR links.
- [ ] **Step 2: Do not run Playwright locally**; run `pnpm exec tsc --noEmit -p apps/web` and let CI run it.
- [ ] **Step 3: Commit** `Test the app catalog screen end to end`.

### Task 7: Mobile list

**Files:**
- Modify: `apps/mobile/app/(settings)/integrations.tsx`
- Create: `apps/mobile/lib/app-catalog-connect.ts`
- Test: `apps/mobile/lib/app-catalog-connect.test.ts`

**Interfaces:**
- Consumes: `APP_CATALOG`, `filterAppCatalog`, `matchAddedServer`, `appCatalogToMcpConfig`, mobile `rpc.mcp.servers.create`, the OAuth session opener already used for MCP in this screen (follow how it opens `authorizationUrl`).
- Produces: `connectCatalogApp` with the same contract as Task 4, on the mobile `rpc`.

- [ ] **Step 1: Write failing tests** mirroring Task 4's five cases.
- [ ] **Step 2: Run** `pnpm exec vitest run apps/mobile/lib/app-catalog-connect.test.ts` → FAIL.
- [ ] **Step 3: Implement** the helper, then add an "Apps" section to `integrations.tsx` using the existing `ConnectorIcon` and `NativeActionButton` (native controls, shared tokens via `mobileTokens`), with the category filter as a native menu.
- [ ] **Step 4: Run** tests and `pnpm exec tsc --noEmit -p apps/mobile` → PASS.
- [ ] **Step 5: Commit** `Show the built-in app catalog on mobile`.

### Task 8: Final checks

- [ ] **Step 1:** Run `pnpm exec vitest run packages/core packages/contracts apps/web/src apps/mobile/lib` and `pnpm lint`; all green.
- [ ] **Step 2:** Review `git status` and the staged diff for secrets or personal data before the PR; PR description quotes the new copy (card names/taglines, "Add", "Added", "Sign in", category names, example prompts) with the reason each is needed, and links the CI screenshot.
