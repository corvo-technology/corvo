# WhatsApp numbers for agents

A person links a WhatsApp number to one of their agents by scanning a QR code. People who write to
that number get answers from that agent, and the owner talks to the same agent from the "Message
yourself" chat of the number.

It runs inside the Rook process, with no extra server. On the desktop app it is always there. A
hosted deployment has it only when its operator turns it on.

## Not the official API

This links the number as a WhatsApp Web device, with an unofficial library (Baileys). WhatsApp can
ban a number that automation touches, and the library follows WhatsApp's changes, so it can break.
The screen says so once, before the QR code. The official WhatsApp Cloud API (one number per
deployment, set by environment variables) is separate and unchanged.

## Linking

In the Store, the WhatsApp card has **Add**. It links a number to the agent that is open, shows the
QR code, and lists the number once it is scanned (WhatsApp, Linked devices, Link a device). Any
number of numbers can be linked. Each number can be paused, resumed, moved to another agent, and
disconnected, which logs the device out of WhatsApp and deletes the session.

A number's session is stored encrypted in the database, one entry at a time. A restart connects
every active number again without a new QR code. A number WhatsApp logs out is shown as
disconnected and is not reconnected.

## Who is who

| Who writes | What it is | What the agent does |
|---|---|---|
| The number's own "Message yourself" chat | The owner | Answers in the agent's main thread, with the owner's access |
| Anyone else, one to one | A visitor | Answers in a conversation and thread of that person's own |
| A group | Ignored | Nothing |
| The owner, in a chat with someone else | Ignored | Nothing |

Only new messages are answered. History from linking, messages that arrive while a number is
paused, and messages delivered more than ten minutes after they were sent are recorded in a
conversation that already exists and never answered.

## What a visitor's agent can touch

A visitor is an outside person, so their run is offered very little:

- The reply tool, and ticket creation where the ticket board is on.
- The connected apps the owner ticked for that number ("Apps visitors can use" on the number).
- Nothing else: not the computer, browser, files, memory, wiki, notes, secrets, the owner's other
  apps, other agents, or the owner's tickets and routines.

The owner's memory, wiki, notes and ticket context are also kept out of the prompt, and the agent is
not told which other apps are connected. The visitor's words, the names of their files and any
transcript sit between markers that say they are an outside person's text, never instructions. A
tool is off unless it is named in the allowlist (`VISITOR_BUILTIN_TOOL_NAMES`), so a tool added
later stays off for visitors until someone decides it belongs.

A conversation stays with the agent that had it if the number is later moved to another agent.

## Replies and limits

- A reply shows typing for a time that grows with its length, with some jitter, and a number sends
  at most 20 replies a minute.
- Each sender can start 6 runs, and each number 60, in any ten minutes. The rest are dropped
  without a reply.
- Voice notes from visitors are transcribed with the speech provider the owner chose in Settings,
  free local or hosted (`docs/local-transcription.md`). They never cause a model to be downloaded,
  and run one at a time per number. A second one that arrives while the first is being read is
  attached with a note instead of waiting, so a stranger cannot fill the worker's slots; the
  agent is told when one was not transcribed.

## Operating it

| | Desktop app | Hosted deployment |
|---|---|---|
| Linked numbers available | Always | Only with `WHATSAPP_LINKED_DEVICES_ENABLED=1` on the API |
| Where the sockets live | The API process | The API process |
| Sending replies | The API process, on a short loop | The API process, on a short loop |

The sockets live in the API process because it owns inbound messages, and a socket is stateful. The
worker never connects and leaves WhatsApp rows in the outbox alone. A number is held by one process
at a time, through a Postgres advisory lock, so a second replica does not connect the same number.

Hosting this for other people's numbers puts each of them at risk of a ban and may break
WhatsApp's terms. Turn it on for a deployment only if that is acceptable to the operator.

## For developers

| Piece | Where |
|---|---|
| The WhatsApp Web library, the only importer | `packages/adapters/src/whatsapp/baileys-client.ts` |
| The client contract and a scripted fake for tests | `packages/adapters/src/whatsapp/client.ts`, `scripted-client.ts` |
| Owner, visitor, recorded or ignored | `packages/adapters/src/whatsapp/classify.ts` |
| The surface that holds the sockets | `packages/adapters/src/whatsapp/link-surface.ts` |
| Pacing and the incoming limit | `packages/adapters/src/whatsapp/pacing.ts` |
| Routing owner and visitor messages | `apps/api/src/whatsapp-inbound.ts` |
| The visitor allowlist | `packages/adapters/src/run-tool-selection.ts`, `executor.ts` |
| Managing numbers over the API | `apps/api/src/whatsapp-numbers.ts` |
| The screen | `apps/web/src/pages/WhatsAppNumbers.tsx` |

Tests are offline and use the scripted client; no test contacts WhatsApp. The library is pinned to
6.7.24 because 7.0.0-rc14 is refused by WhatsApp's server (`docs/superpowers/specs/2026-11-06-whatsapp-linked-number-spike.md`).
It pulls `libsignal` from a pinned GitHub tarball.

Not yet: routing a visitor's message to other agents, groups, a message the agent starts, a way
for the owner to write into a visitor's conversation (no client can write to those threads today,
which is also what keeps an owner's message from mixing with a visitor's), a web view of a
visitor's conversation (the mobile app lists them), and the mobile screen to link a number.
