# Built-in app catalog

## Intent

People should connect the apps they use (Linear, Stripe, Sentry, Notion, ...) in a few clicks, without hunting for MCP URLs. Today the Integrations overlay (`apps/web/src/pages/PluginsOverlay.tsx`) only shows a catalog when the server is configured with one, so a fresh deployment looks empty and "Browse MCP servers" is the only path. The OpenBot desktop app solves this by shipping a curated catalog of ready-to-connect apps. We bring the same idea to Corvo and make the Integrations screen feel like OpenBot's.

## Goals

- Ship a curated catalog in the repo: as many useful apps as we can verify, starting from the ~30 OpenBot ships (Linear, Notion, Stripe, Supabase, Sentry, Figma, Vercel, Cloudflare, Trello, Todoist, Resend, Airtable, PostHog, Neon, Prisma, Netlify, Railway, Render, Firecrawl, Brave Search, Context7, Hugging Face, Atlassian, Obsidian, Canva, ...), then growing.
- One click to connect: remote MCP servers with OAuth sign in through the browser; servers that need a key show only the fields they need, with a link to where to get the key.
- Integrations screen close to OpenBot: app cards with icon and short description, category filter, featured row first, search, Add / Added, and a detail view per app.
- After an app is connected, show 2-3 example prompts the person can click to start a chat.
- Same catalog on web, desktop (hosts the web UI) and mobile, from one source in `packages`.

## Non-goals

- No hosted marketplace, publishing flow, ratings or per-app payments.
- No new MCP runtime. Connecting an app creates a normal MCP server through the existing `mcp.create` RPC.
- No copying of OpenBot code or assets. We take the idea and public facts (server URLs, names); descriptions, prompts and structure are our own. Icons come from each vendor's public favicon or logo URL.
- Composio stays as it is (an optional provider for the long tail); it is not replaced.

## Anti-goals

- A catalog that lists apps which fail to connect. Every entry must have been checked against its server.
- Extra explainer copy on the screen (AGENTS.md: every visible word is UI). Cards carry a name and one line; example prompts appear only after connecting.
- Vendor-specific code paths or env vars. Entries are data; the connect flow is generic.

## What exists

- `McpServerConfigInput` (`packages/contracts/src/domain.ts`) already supports `streamable_http` / `sse` endpoints, OAuth discovery with an optional pre-registered `oauthClient`, static `headers` and `secret`.
- RPC `mcp.create`, `mcp.update`, `mcp.test` and bot-level `mcp` assignment exist (`packages/contracts/src/rpc.ts`).
- Featured Composio connectors and `app_connect` chat cards live in `packages/core/src/featured-connectors.ts` and `app-connect.ts`.
- The overlay already has search, MCP server list, "Show more" and an Advanced section.

## Shape of the solution

**Catalog entry (data, one file per app, validated by a zod schema in `packages/contracts`):** `slug`, `name`, `tagline`, `category`, `iconUrl`, `featured`, `server` (a subset of `McpServerConfigInput`: transport, endpoint, and an `auth` description: `oauth`, or `key` with field list, header name, hint and docs URL), and `prompts` (up to 3).

**Where it lives:** a `packages/core` module exporting the typed list, so every surface imports the same data. Offline conformance test: every entry parses against the schema, slugs are unique, URLs are https, and every entry converts into a valid `McpServerConfigInput`.

**Connect flow:** the frontend sends the entry slug (plus key fields when needed); the backend builds the `McpServerConfigInput` from the catalog entry and calls the existing create path, then returns the sign-in link for OAuth entries. The frontend expresses intent; the backend owns validation and construction.

**Screen:** the overlay's top section becomes a grid of cards, featured first, with a category filter. Installed apps show "Added". Clicking a card opens a detail view (reuse the existing detail/back pattern in `PluginsOverlay.tsx`) with Add, account management and the example prompts once connected. Mobile gets the same list in `apps/mobile/app/(settings)/integrations.tsx` using native controls per AGENTS.md.

## Decisions

- Mine (builder may change with a reason): the catalog starts from the OpenBot list above; entries ship as TypeScript data, not JSON fetched at runtime, so it works offline and needs no vendor.
- Mine: categories are a small fixed set (e.g. coding, productivity, data, design, automation).
- Open for the builder: exact visual layout; follow OpenBot's card grid and existing shadcn components.

## Risks / to verify

- Each remote MCP URL and its auth style must be confirmed against the live server before the entry ships. Servers without dynamic client registration need a registered client id; those either get skipped or documented as "manual".
- Some OpenBot entries are specific to OpenBot (e.g. `cobrain`, `aave`, `apple-apps`); drop what does not make sense for Corvo.
- Icons loaded from vendor URLs are an external request from the UI; consider proxying or bundling if that is a privacy concern.

## Testing

Deterministic and offline: catalog schema/uniqueness tests, entry-to-`McpServerConfigInput` conversion tests, and a web test that opens the Integrations screen (CI screenshot for the PR). Marketing pages are not involved.
