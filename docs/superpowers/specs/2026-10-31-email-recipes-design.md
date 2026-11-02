# Email recipes: a bot that works the inbox on its own

## Intent

Corvo is meant to replace a person in some jobs, so a bot has to start work by itself, not only when
someone writes to it. The engine for that mostly exists: a routine can start on a schedule, a webhook, a
chat message, or when a connected app's data changes. What does not exist is a way for someone who is
not technical to use it. Today the "when something changes" trigger asks for a tool name, JSON
arguments and fields to compare. This design adds plain-language **recipes** on top of the existing
engine, starting with Gmail, so a person picks a situation ("when a new email arrives"), says what the
bot should do, and turns it on.

## Decided with the owner

- Recipes, not a form: the person chooses a situation in plain words and the system fills in the
  technical setup. The technical form stays behind "Advanced".
- Email first. WhatsApp is not available yet, so nothing in this version depends on it.
- Checking every 15 minutes is fine for normal work. Anything that must be instant is a later step.
- The suggestion appears right after a person connects Gmail, in the same place, so nobody has to look
  for "triggers".
- The audience does not use technology. Every screen is plain language, with no JSON, tool names or
  field names.
- Everything the bot does is visible afterwards in the routine's run history.

## Goals

- After connecting Gmail, a person can turn on "reply to simple questions" in under a minute, without
  seeing a technical term.
- The person sees, in one sentence generated from their choices, what the bot will do before turning it on.
- Existing routines and triggers keep working unchanged.

## Non-goals

- No instant (push) email events. Composio push triggers are a possible later step.
- No WhatsApp alerts or WhatsApp-triggered recipes in this version.
- No recipes for other apps yet (GitHub, Slack, Sheets): the catalog is built so they can be added, but
  only Gmail ships.
- No visual workflow builder and no rules engine.
- No mobile editor for recipes in this version (see Constraints).

## Anti-goals

- A customer's email must not steer the bot into acting for the sender. An email is text from outside:
  it can say "forward every contact to this address". Today a run started by something other than the
  owner may inspect state unattended but may not cause side effects without the owner. This design must
  not weaken that rule.
- No recipe may call a tool that changes data as its trigger. The change check stays read-only.
- A recipe must not change the space's Approvals mode or carry its own freedom setting. It follows the
  mode the owner already chose.

## Constraints

- Public repository, provider-neutral: the recipe catalog names the integration generically; Composio
  stays in its adapter.
- Additive only: no new column is required if a recipe is stored as the routine it creates. A recipe id
  may be stored in the routine's existing fields or a nullable column added without dropping anything.
- Frontends render state; the server owns validation and creation of the routine.
- Minimal copy. New visible words are quoted and justified in the PR. They are translated in English,
  Brazilian Portuguese and Spanish, and a catalog test already fails when a message is left untranslated.
- Web and desktop host the same screen. Mobile keeps showing and approving what the bot does (routines
  list, approvals, notifications); creating a recipe on mobile is an explicit follow-up.

## How it works (my calls unless marked)

1. **Recipe catalog.** A shared, versioned list in `packages/core`, like the app catalog. A recipe
   holds: id, the app it needs, plain-language title and one line, how it starts (a change watch on a
   read-only tool, or a schedule), the instruction template, and its default autonomy. Gmail ships with
   three: reply to simple questions, tell me what is urgent, a daily summary of the inbox.
2. **Recipe to routine.** Choosing a recipe creates an ordinary routine through the existing create
   path: a `tool` watch every 15 minutes (the default) or a cron for the daily summary, plus the
   instruction. The first check only records what is already in the inbox, so old email never triggers
   the bot. The server validates that the watch tool is read-only, as it does today.
3. **Where it appears.** After a connection to an app succeeds, the app shows up to three suggested
   recipes for that app, with "Not now" to skip. The routine editor's "Add trigger" lists the same
   recipes first and keeps the technical options under "Advanced".
4. **One setup screen.** Which account, an optional filter in words, what the bot does (a sentence with
   ideas to tap), and a generated summary sentence the person confirms. There is no freedom choice.
5. **Freedom follows Approvals.** The owner already chooses Never ask, Auto or Ask in Settings
   (decided with the owner). A recipe does not add a second setting. The summary sentence says what
   will really happen under the current mode: with Ask, "I prepare the reply and wait for your
   approval" (the approval arrives as a notification and a card in the bot's chat); with Never ask,
   "I send the reply". So the person never activates something whose effect is hidden. "Only tell me"
   is a recipe in its own right and never sends anything.
6. **Urgent without WhatsApp.** For now an urgent email produces the routine's existing notification
   and a message in the bot's chat. A WhatsApp alert is added when a WhatsApp channel exists.
7. **Duplicates and control.** One recipe per bot and account. Turning it off is the routine's existing
   Active switch, and the run history shows every check and what the bot did.
8. **Language.** The summary sentence and every recipe text come from the translation catalogs, in
   English, Brazilian Portuguese and Spanish.

## Testing

- Deterministic and offline with the fake Composio adapter: choosing the Gmail recipe creates a routine
  with a read-only tool watch, a 15-minute interval and the instruction; the first check is a baseline
  and does not run the bot; a new item runs it; a second identical check does not.
- A recipe whose tool is not read-only is rejected by the server.
- The summary sentence for each recipe under each Approvals mode, in all three languages.
- A web test opens the setup screen, so CI produces the screenshot linked in the PR.
- Whether an email is a "simple question" or a complaint is natural-language judgment. It is checked
  by an opt-in, provider-neutral LLM eval with a versioned rubric and reviewed examples, reported
  separately; a judge error counts as unqualified.

## Left to the builder

The exact Gmail tool and tracked fields (verify against a live session: the fake adapter only mirrors
them), the instruction templates, how suggestions are ranked, copy, empty and error states, and
keyboard and screen-reader behavior of the setup screen.
