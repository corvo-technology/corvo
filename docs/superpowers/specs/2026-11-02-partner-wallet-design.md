# Partner wallet: the partner pays for its customers' use

## Intent

A partner (a SaaS company such as `acme-saas`) is the paying account. It puts money in its own
wallet, and what it passes on to each customer (`allowanceCents` on the tenant call) is taken from
that wallet. The deployment's operator no longer carries the partner's customers' model cost out
of its own provider bill without a bound. The partner can also cap how much it passes on.

## Goals

- A wallet per partner with a balance in US dollars. A pass-on that the wallet cannot cover is
  refused; the wallet never goes below zero, even with calls at the same instant.
- Passing on **reserves** the amount from the wallet. What the customer has not used when the
  month ends **returns** to the wallet, once.
- Limits the partner sets: the most one customer can be given per month, and optionally the most
  the partner passes on in total per month.
- The partner sees balance, passed on this month and limits in Settings > Partnership.
- The three partner calls, the key and the frame stay as they are. The tenant call only gains
  two refusals.

## Non-goals

- Charging the partner's customers (the partner does that in its own product).
- A separate wallet table or any new payment flow: Stripe already funds the owner's account.
- Changing how a customer's own credit is spent: it still runs through the existing credit lots.
- Per-agent or per-day limits.

## Anti-goals

- Credit created from nothing, or counted twice, by a repeated, raced or retried call.
- A refusal that leaves a customer half set up in a way that cannot be repeated safely.
- A partner reading or changing another partner's wallet.

## How it works

1. **The wallet is the partner owner's own credit account.** The person who runs the partner
   already has an organization and, through Settings > Billing, a model credit account funded by
   Stripe (one-time purchases and monthly credit). That balance is the wallet, so filling it needs
   no new payment code: the partner buys credit exactly as any other account does, and the
   Partnership page links to Billing.
2. **Passing on.** The tenant call sets the customer up as today. If it names `allowanceCents`,
   the missing amount for that month is computed as today (a raise adds only the difference;
   lowering takes nothing back). In order: check the per-customer limit; check the monthly total
   limit; reserve the amount on the owner's credit account with the existing reservation, under an
   identity equal to the customer grant it pays for (`allowance:<partner>:<tenant>:<period>:
   <base|raise:N>`), which refuses when the balance is short and never goes below zero; then grant
   the customer, which is already idempotent. If the grant fails after the reservation, repeating
   the call finds the reservation and finishes the grant without reserving again.
3. **Refusals.** Wallet short: HTTP 402 `wallet_insufficient`. Over a limit: HTTP 409
   `allowance_limit`. The customer and its agents are still created or updated and the body
   carries `tenantId`, so the partner can fix the wallet and call again. (My call: status codes,
   not a field in a 200, because a partner that ignores a field would silently leave customers
   without credit.)
4. **Return.** When a month ends, the housekeeping job settles each reservation of that month
   down to what the customer actually used (the grant minus what expired unused), using the
   existing settlement, which gives the difference back to the owner's credit lots. Settling
   twice returns once.
5. **Limits.** Two nullable columns on the partner: `perTenantLimitCents` and
   `monthlyLimitCents` (none by default, my call). The monthly total is the sum of that
   month's passed-on amounts. Edited in Settings > Partnership.
6. **Visibility.** `partner.status` returns the wallet balance, the amount passed on this month,
   the limits, and each customer's balance as today. The settings page shows them, the two limit
   fields, and a link to Billing to add credit.

## Security

- All wallet rows are system-only, like the other partner tables; the settings route reads them
  only for the caller's own partner.
- The balance changes only through a single conditional update, so two calls at once cannot both
  spend the last dollars.
- Amounts are whole cents, positive, and bounded as today.

## Risks the builder must check first

- The credit ledger's background reconciler treats a pending reservation as an unknown-cost
  hold. A passed-on reservation is deliberately open for a month, so confirm the reconciler
  leaves it alone (or give these reservations a state it ignores) before relying on this.
- The owner's account is also the owner's own: they can spend the wallet on their own use. Fine
  for the pilot; a separate owner organization for the programme is a later option.
- A reservation needs the owner's account to be in credit mode; a new partner owner who has
  never bought credit has no balance, so every pass-on is refused until they do.

## Left to the builder

Table and column names, the exact migration (additive only), the layout of the wallet block in
the settings page, and the copy of its labels.
