# WhatsApp numbers for agents

## Intent

An agent can have its own WhatsApp number. People write to it and the agent answers on its own,
the way a support or sales agent would. The owner can also talk to an agent from their phone, in
the "Message yourself" chat of a linked number, with the same powers they have in the app.

It runs inside the one Rook process, with no extra server: on the owner's computer in the desktop
app, and the same way on a hosted deployment. It is a store app: adding it is how a number gets
linked.

## Why this and not the other ways

- **The official WhatsApp Cloud API** is already wired in (`provider: "whatsapp"`, set by
  deployment environment variables). It gives one number per deployment, needs a verified
  business, and cannot be added by a person from the store. It stays as it is.
- **WAHA** (the owner's fork, Apache-2.0) is a separate HTTP server with several engines, some of
  which start a browser per number. It would be one more process to ship and supervise.
- **Baileys** is a library that speaks the WhatsApp Web protocol over a websocket inside our own
  process. No server, no browser. This is what the owner chose, and what OpenBot uses.

## Goals

- Add WhatsApp from the store, scan a QR code, pick the agent responsible for the number, done.
- One agent per number, answering everyone who writes to it, always on its own. No approval step.
- The owner's "Message yourself" chat is the owner; every other chat is a stranger.
- Any number of numbers per installation. There is no product limit.
- Works on web and desktop (the desktop hosts the web UI). Hosted deployments use the same code.
- Voice notes and files arrive as attachments like they do from Telegram, and a voice note from
  anyone who writes to the number is transcribed before the agent runs, with the free local speech
  models.

## Non-goals (first version)

- Routing a stranger's message to other agents (the Chief, a CTO agent) or opening tickets from
  the platform. The agent's own instructions do that work for now, using what it already has.
- Allow lists, approval codes, contact and group management screens.
- Group chats. Messages from groups are ignored.
- Sending the first message to someone who never wrote. The agent only replies.
- A mobile screen. Linking needs a second device to scan the code, and mobile can show the list
  of numbers later.
- Replacing the official Cloud API transport.

## Anti-goals

- A stranger gaining owner powers. Their messages are data for the agent, never instructions to
  other agents, and the owner-only tools and routing stay off for them, exactly as for a
  non-owner on Telegram.
- Messages sent that nobody asked for. Anything that looks like bulk sending is a bug, because it
  gets numbers banned.
- Extra words on screen. Every visible word is UI.

## What the owner decided

- Baileys, inside the Rook process. Not WAHA.
- WhatsApp is an app in the store. Adding it links a number; adding it again links another.
- No limit on numbers.
- One agent per number, answering alone, always.
- Whether the number is personal or separate does not matter to the product.
- One warning before linking: this is not the official API and the number can be banned. That is
  the only explanation on the screen.
- First version: WhatsApp working. Routing between agents comes later. The agent creates tickets
  or tells the person it passed the matter on through its own instructions, and the owner can tell
  it to call them through the Chief.

## What a stranger's conversation can touch (decided by the owner: as safe as possible, still a normal attendant)

- **Each person who writes gets their own conversation.** Messages from one person never mix with
  another's, and the agent carries nothing from one person to the next. The owner sees all of them
  in the app and can step into any one. Changing a number's agent leaves existing conversations
  with the agent that had them.
- **A stranger's run can only talk, plus the tools the owner ticked for that number.** The owner
  picks, per number, the few connected apps the agent may use with visitors (a ticket app, a
  lookup). Everything else is off for strangers: the owner's other apps, the owner's memory, the
  browser, the host computer and the team routing tools.
- **What the agent knows about the business** is its own instructions and the history of that one
  person's conversation. The agent being a good attendant is the job of its instructions and of
  the tools the owner ticked, not of wider access.
- **The line is new work.** Today a run uses the owner's access in every chat, and there is no
  gate for a non-owner in a 1:1 chat, so this boundary is built as part of this feature and is
  tested as the security boundary it is: a stranger's run is offered the ticked tools and no
  others.

## The screens

1. In the store, a **WhatsApp** card. **Add** opens the link flow.
2. A single line of warning, then the **QR code**. The person scans it in WhatsApp on their phone
   under Linked devices.
3. A picker for the **agent responsible** for this number.
4. The number appears under installed apps with the agent's name and the apps it may use with
   visitors. A number can be paused,
   disconnected (which logs it out of WhatsApp and deletes its session), and its agent changed.

The number is shown masked, as in OpenBot's screens.

## How it behaves

- **Owner or stranger.** A direct message authored by the linked number itself, in its own
  "Message yourself" chat, is the owner. Everything else is a stranger. A group message is dropped.
- **Replies.** Delivery goes through the existing messaging path (outbound queue, retries,
  status), so a reply survives a restart. Each reply is preceded by the typing indicator and a
  short delay, and replies are rate limited per number, to look like a person and lower the risk
  of a ban. These are the builder's to tune.
- **Session.** The linked-device credentials are a secret and are stored like other messaging
  credentials. Disconnecting deletes them. A restart reconnects every active number without a
  new QR. A number WhatsApp has logged out is marked disconnected and shows that, instead of
  retrying forever.
- **Exactly one holder.** A number's socket is held by one process at a time. On a deployment
  with several replicas, the builder must make sure two never connect the same number.
- **Voice notes.** A voice note from anyone is transcribed by the existing local transcription
  (`docs/local-transcription.md`) before the agent runs, and the agent reads the text inside the
  same labeled machine-transcript block. That feature is owner-only today, on purpose, so this
  work relaxes the rule for chats that arrive through a linked number, and only there:
  - It uses the voice provider the owner chose in Settings: a free local model or a hosted one.
    The choice is the owner's. With no choice made, the free local model is used.
  - A stranger can make the computer do work, so the builder must bound it: the existing 8 MiB
    limit, one transcription at a time per number, and a short queue that drops the excess with
    a note to the agent instead of piling up.
  - A stranger cannot cause a model download: if the speech model is not on the computer, their
    audio stays a file with a note, and the owner's own audio triggers the download as before.
  - Everything the transcript says is still data, never an instruction.

## Constraints

- Public repo: no real numbers, sessions or secrets in tests or fixtures.
- Provider-neutral: the WhatsApp Web library lives only in an adapter, behind the existing
  messaging surface, so it can be replaced when the protocol changes.
- Tests are deterministic and offline: a scripted fake of the library's socket. Real WhatsApp is
  never contacted by a test.
- Migrations are additive.
- The engine must bundle into the desktop app, like the other native and ESM dependencies.

## Risks

- **Ban.** WhatsApp can ban a number that automation touches. The warning is the answer, plus the
  reply pacing above.
- **Protocol drift.** Baileys is unofficial and follows WhatsApp's changes. Pin the version and
  keep the adapter thin so it can be swapped.
- **Hosted use.** Running an unofficial client for many people's numbers on a hosted service may
  break WhatsApp's terms and puts every customer's number at risk. Whether it is enabled on a
  hosted deployment is the operator's decision; the default is to enable it only where the
  operator turns it on, and always on the desktop app.
- **Memory.** Each connected number holds a socket and its session state. There is no limit, so
  the builder should measure one number and say what a dozen cost.

## Calls made while writing (the owner can change these)

- **The owner's messages in other chats are ignored.** Only the "Message yourself" chat is the
  owner talking to the agent. What the owner types to a friend is not agent input, and the agent
  does not answer a chat the owner already answered. A "pause when the owner steps in" mode comes
  later.
- **Only new messages are answered.** Old history from linking, messages that arrive while a
  number is paused, and messages delivered late after a reconnect are recorded and never
  answered. Answering a backlog is the bulk sending this design calls a bug. The builder picks the
  cutoff for "late".
- **Incoming load is limited.** Each sender and each number has a run limit, and the excess is
  dropped without a reply. There is no money budget in the first version.
- **The self-chat reaches the number's agent in the agent's main thread**, so the conversation
  continues from the phone. An agent may have several numbers; their self-chats share that thread.

## Left to the builder

- The provider id for this transport next to `whatsapp` (the Cloud API), and how both mount.
- The session storage format and where it lives.
- Reconnect and backoff policy, and how a QR is streamed to the page.
- Whether to offer the pairing code (phone number plus a typed code) next to the QR.
- Pacing numbers and the shape of the store entry.
