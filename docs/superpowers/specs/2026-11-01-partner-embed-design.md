# Partner embed: the assistant inside a partner's own page

## Intent

A partner (a SaaS company such as `acme-saas`) wants its customers to use Corvo agents without
leaving the partner's product. Today the customer is redirected to the Corvo app. The embed puts the
agents' chat inside a frame in the partner's own page, signed in as that customer, with a theme and
language chosen by the partner. The partner adds one element and one backend route.

## Goals

- One element in the partner's frontend: `<corvo-assistant session-url="/corvo/session">`, plus a
  React wrapper over the same element.
- The partner's secret key never reaches a browser, and neither does a long-lived credential for
  the customer: the partner's page only ever handles a one-use code.
- The customer is signed in without third-party cookies, which Safari and Chrome block in frames.
- The partner picks `theme` (`light`, `dark`, `auto`), `locale` and an accent, and can change them
  without reloading.
- Every UI language in the supported set works in the embed, right to left included.
- Pausing a customer still stops its agents; the embed gives no new way to run work.

## Non-goals

- A headless client or a custom chat built by the partner (the second model; same token layer
  makes it possible later).
- Embedding the full app: no menu, settings, billing or onboarding inside the frame.
- Native mobile SDKs; a web view of the partner's page already works.
- Per-partner branding beyond theme, locale and accent.

## Anti-goals

- A frame that shows or does anything without a valid one-use code made by a partner's backend.
- A bearer token readable by the partner's JavaScript or stored where other scripts can read it.
- Any change to how the existing app authenticates when it is not embedded.

## How it works

1. The partner's page renders `<corvo-assistant>`. The element calls `session-url` on the
   partner's own backend (cookie auth of the partner's product).
2. That backend calls the existing `POST /api/partner/v1/sessions` and returns `{ code }` (the
   hashed, single-use, 60-second entry code made today) to the page.
3. The element creates an iframe `https://<corvo>/embed#code=<code>&theme=..&locale=..&accent=..`.
   The fragment is never sent to a server or logged.
4. The embed page reads the fragment, removes it from the address, and calls
   `POST /api/partner/embed/exchange { code }`. The server spends the code with the same single
   conditional update as the redirect entry and returns a signed session bearer token and its
   expiry. The token lives in the frame's memory only.
5. In embed mode the RPC link and the auth client send `Authorization: Bearer <token>` instead of
   relying on a cookie. The rest of the app code is unchanged.
6. Before expiry the frame asks the parent for a new code through `postMessage`
   (`{type:"corvo:refresh"}`); the element repeats steps 1 to 4. Without an answer the frame shows
   the signed-out state.
7. Any page may frame `/embed` (no origin list). That is safe because a frame with no valid code
   shows nothing. The parent may send only `theme`, `locale` and `accent` by `postMessage`; the
   frame never accepts anything that touches authentication from it, and the token never leaves
   the frame.

## What changes in Corvo

- **Server.** `POST /api/partner/embed/exchange`; a session created through it is a normal Better
  Auth session (hooks, security events, `via: "/partner/embed"`), that the frame renews every 8 hours with a new code. The server session refreshes like any other while used, so the 8 hours is the frame's renewal horizon, not a hard cap; a hard cap is a follow-up.
  The redirect entry stays as it is.
- **Framing.** The web server sends `Content-Security-Policy: frame-ancestors https: http://localhost:*`
  for `/embed` only, and the Caddy files drop
  `X-Frame-Options` for that path. Everything else keeps `frame-ancestors 'none'`. There is no
  allowed-origin list: the user chose to leave framing open.
- **Web.** A `/embed` route with a minimal shell: the chat and the agent switcher only. Theme,
  locale and accent come from the fragment and `postMessage`, override stored preferences, and are
  not saved.
- **SDK package** `@corvo/partner-sdk`: the element, the React wrapper, a server helper
  `createEmbedSession(key, tenant, user)`, and types. Built to a single ES module served from the
  Corvo origin at `/sdk.js` and published to npm.
- **Contracts.** `PartnerEmbedExchangeInput/Result` and the `postMessage` message types.

## Security

- The code is the existing 256-bit single-use credential; the exchange is rate limited per IP and
  uses the same atomic spend, so a replayed or raced code yields one token.
- A token acts only as that customer's owner, as a redirect session does. A paused customer's
  runs are refused by the executor; `suspend` also ends its embed sessions at the next refresh
  because no new code is issued.
- Responses to `/embed` and the exchange send `Cache-Control: no-store` and
  `Referrer-Policy: no-referrer`.
- The frame sets no cookie, so nothing is shared with the app's own session in another tab.

## Languages

The embed uses the app's catalogs, so a language is supported when its catalog is complete (the
catalog test fails on any empty translation). Today: `en`, `pt-BR`, `es`. The set to add is the
user's decision; each new language is a full translation of the app's strings, reviewed by a
speaker before release. Right-to-left layout is already handled by `applyUiDirection`.

## Open questions for the user

1. Which languages, beyond `en`, `pt-BR` and `es`? Proposed order by reach for this product:
   `fr`, `de`, `it`, then `ja` and `zh-CN`.
2. Session lifetime in the frame: 8 hours with silent refresh (proposed).
3. Allowed origins: decided by the user, no list (any site may frame `/embed`).

## Left to the builder

File layout of the SDK package, bundler, element naming details, how the accent maps onto the
tokens, and the exact set of strings used only by the embed shell.
