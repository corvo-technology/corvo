# Partner pilot

A SaaS partner (here `acme-saas`) embeds Corvo agents for its own customers. The partner's backend
calls a small API; each customer gets an isolated organization with one owner, a connector to the
partner's system, and starter agents. Nothing here needs a hosted vendor.

## Operator: the Partnership page

Set `PARTNER_ADMIN_EMAILS` (comma separated) on the API. Those people see **Settings > Partnership**:
they become a partner by entering a company name, copy the key (shown once), replace it with
**New key**, and pause or resume each customer. Nobody else sees the page, and its calls answer
not found for them. Each customer row shows what it has used this month and what it has left;
when a customer's credit runs out, its runs say "This month's credit is used up."

## Operator: create and rotate a key from the command line

Run on the server with the runtime `DATABASE_URL`:

```
pnpm --filter @corvo/api partner create acme-saas "Acme SaaS"   # prints the key once
pnpm --filter @corvo/api partner rotate acme-saas               # old key stops working
pnpm --filter @corvo/api partner disable acme-saas              # key refused; its customers' links stop
pnpm --filter @corvo/api partner enable acme-saas
```

Only a hash of the key is stored. Give the key to the partner over a private channel.

## The three calls

All calls send `Authorization: Bearer <partner key>` and JSON. Every refusal for a missing or wrong
key is the same `401`; a customer that does not exist and one that belongs to another partner both
answer `404`.

1. Create or update a customer (safe to repeat):

   ```
   PUT https://corvo.example.com/api/partner/v1/tenants/{externalTenantId}
   { "name": "Shop One",
     "connector": { "slug": "acme-system", "name": "Acme system",
                    "endpoint": "https://mcp.acme.example/v1", "token": "<per-customer token>" },
     "agents": [{ "key": "manager", "name": "Manager", "instructions": "...", "usesConnector": true }],
     "allowanceCents": 1500, "period": "2026-11", "state": "enabled" }
   → { "tenantId": "...", "created": true }
   ```

   `"locale"` (optional, for example `"pt-BR"`) is the customer's language: it names the customer's
   Chief, the agent in front of the partner's agents. Portuguese reads Portuguese; no `locale`, or
   any other language, reads English. It only matters when the customer is first made.

   Each agent may also carry `"starters": ["Show today's bookings", ...]` (up to four short
   messages), shown as buttons while its chat is empty; a tap sends it.

   Agents are made once per `key` and never overwritten, so what the customer edits stays. Define
   the agents and the connector once under Settings > Partnership (**Agents > Edit**) and the call
   can be just `{ "name": "Shop One", "connectorToken": "<token>", "allowanceCents": 1500 }`; what
   the call names itself wins over the template. The same page lists areas to **Hide from
   customers** (routines, workflows, usage, artifacts, store); agents always stay. Hiding only
   removes the entry from the bar. Customers use the deployment's model and cannot change it
   (the picker is hidden and the server refuses a change) unless the template ticks **Customers
   can choose the model**. The template's connector has no token, so each
   call sends `connectorToken` for its customer. The
   connector token and address follow the latest call. `allowanceCents` is the customer's credit for
   the month (default: the current one); raising it adds the difference, lowering it takes nothing back.

   The partner pays for it. A partner made in the app (Settings > Partnership) passes credit on
   from its owner's own credit account, the one filled in Billing. A pass-on the account cannot cover
   answers `402 {"error": "wallet_insufficient"}`; one over a limit the partner set (per customer or
   in total per month, on the same page) answers `409 {"error": "allowance_limit"}`. The customer
   and its agents are still set up, and the body carries `tenantId`, so the partner adds credit or
   raises the limit and repeats the call. What a customer leaves unused when its month ends goes
   back to the owner's account. A partner made on the command line has no owner account, so it has no
   credit to pass on and every `allowanceCents` is answered `402`; make the partner under Settings >
   Partnership instead, and buy credit in Billing.

2. Pause or resume: `POST /api/partner/v1/tenants/{externalTenantId}/suspend` and `/resume`
   (or `state` on the `PUT`). A paused customer's runs fail at once with "This account is paused."
   and no link opens. Pausing also signs the customer out everywhere, so a frame that is already
   open stops at once. A customer's session also ends eight hours after it began, however
   it is renewed, so the page asks for a new code at least that often.

3. Let a person in: `POST /api/partner/v1/sessions`
   `{ "externalTenantId": "...", "externalUserId": "...", "email": "optional" }`
   → `{ "url": "https://app.example.com/api/partner/enter?code=...", "expiresAt": "..." }`.
   Redirect the browser to `url` within 60 seconds. The link works once, then signs the person in
   as the customer's owner.

## What the partner's backend implements

- A button (or menu item) that calls the sessions endpoint server-side and redirects to the URL.
- One route that provisions a customer when it signs up (the `PUT` above).
- A connector token per customer, and an MCP server at the connector address that accepts it and
  only returns that customer's data.

## Embed the assistant in your own page

Instead of redirecting, put the assistant in a frame on your page, signed in as the customer.

1. A route on your backend (for example `POST /corvo/session`) that calls Corvo's
   `POST /api/partner/v1/sessions` for the logged-in customer and returns `{ "code": "<code>" }`
   from the answer. Return only the code: never the key, never the redirect address.
2. On your page:

   ```html
   <script src="https://app.corvo.example.com/sdk.js"></script>
   <corvo-assistant session-url="/corvo/session" theme="auto" style="height: 600px"></corvo-assistant>
   ```

   `theme` is `light`, `dark` or `auto`; `locale` is `en`, `de`, `pt-BR`, `zh-CN`, `es`, `fr` or
   `ja` (default: the visitor's language). `accent` is your main colour as `#rrggbb` (for example
   `accent="#e11d48"`): buttons and the current state use it, and the text on it turns light or dark
   to stay readable; leave it out to keep Corvo's own green. Change any attribute and the frame
   follows without reloading. The element asks your route for a new code whenever the frame needs one, and fires
   `corvo-ready` and `corvo-expired` events.

The frame keeps its session token in memory only (a frame cannot keep a cookie on another site),
so the page never sees it. Any site may frame the page, but a frame without a valid one-use code
shows nothing.

## Try it without a partner

With the API running and the key of a partner made under Settings > Partnership that has credit in Billing (a partner made with `partner create` has none, so its allowance is refused):

```
PARTNER_API_URL=http://127.0.0.1:3100 PARTNER_API_KEY=<key> pnpm --filter @corvo/api partner:demo
```

For the embed, `pnpm --filter @corvo/api partner:embed-demo` (with `PARTNER_API_URL`,
`PARTNER_API_KEY` and, if the web app is on another address, `CORVO_WEB_URL`) serves a pretend
partner page on `http://localhost:4310` with theme and language selectors.

The first command creates a demo customer with two agents and prints the link. Open it: you land signed in, with
the agents present and no onboarding or billing screen.

## What the pilot deliberately does not do

- One Corvo seat (the owner) per customer; the partner's own users share it.
- No embedding in the partner's page, per-user permissions, usage budgets, events back to the
  partner, shared agents, versioned agent updates, or more than one partner per deployment's
  branding.
- Speech summaries and team-chat judging are not paused with the account.
- Credit rows are scoped to an organization for sessions acting for a space; server code with no
  space (webhooks, the worker) can still read them, as it spans organizations.
