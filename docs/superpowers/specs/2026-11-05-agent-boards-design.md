# Agent boards

Status: draft for the owner's approval. Nothing here is built.

## Intent

A person with a team of agents cannot see, in one place, what each agent is working on, and has no home inside Rook for work that is not a chat: leads to follow up, support cases, content to publish. Rook already has a ticket board, but there is one per Space, it is off in the desktop app, and it does not tell the person when an agent finishes something.

The goal is several boards in one Space (Leads, Support, Content...), cards the agents and the person both move, and a clear answer to "what is each agent doing right now". The person is told when an agent finishes something.

## Goals

1. A Space can have several boards, each with its own name and ticket prefix (`LEAD-4`, `SUP-9`).
2. The six statuses stay as they are underneath (`todo`, `doing`, `review`, `blocked`, `done`, `closed`); each board can show its own label for each one ("Doing" becomes "In contact" on the Leads board).
3. A ticket has a place for data: a short list of named fields that people and agents can read and write.
4. At a glance, a card shows who owns it and whether that agent is working now; the Team screen shows each agent's tickets in progress.
5. When a card moves to Review or Done, the person gets a desktop notification, the agent says so in its own chat, and the agent tells the Chief.
6. The board works in the desktop app by default, on web and desktop. Mobile is not part of this.

## Non-goals

- Mobile screens, and push notifications to a phone.
- Custom statuses or columns beyond relabelling the six, swimlanes, due dates, automations between boards.
- A separate CRM object for leads: a lead is a ticket.
- A new wake rule: an agent is woken when a ticket is assigned or reassigned to it, as today, and never by a status change or a comment, because each wake is a paid run.

## Anti-goals (a failure even if it works)

- Boards that agents flood with tickets nobody asked for.
- A notification for every move; only Review and Done notify.
- Any visible words that explain the screen to itself. Copy stays minimal.
- Lead data (contacts, values) copied to places the board's readers cannot already read.

## What exists today (verified in the repository)

- `Board` (one per Space: `spaceId` is unique, with `ticketPrefix`, `nextNumber`), `Ticket` (number, title, description, status, priority, owner bot, creator bot or user, `completedAt`) and `TicketComment`. A ticket's ref is `<prefix>-<number>`.
- Statuses and priorities are fixed in `packages/contracts/src/board.ts`.
- Agent tools: `board_tickets`, `ticket_get`, `ticket_create`, `ticket_update` (title, description, priority, status, owner), `ticket_comment`.
- Assigning a ticket to an agent queues a run for it (`trigger: "tickets"`) with a prompt to read the ticket, keep progress in comments and update the status.
- A board change publishes a transient signal (`boardId`, `ticketId`) on a per-Space stream; the web board reloads on it. The signal does not say what changed.
- The web `Board` screen at `/app/board` (columns by status, a ticket dialog, comments), reached from the account menu. It exists only when `TICKET_BOARD_ENABLED=true`, which defaults to false and which the desktop app does not set.
- The Team screen shows each agent as working or idle.
- Desktop and web notifications fire only for the chat that is open; nothing app-wide exists.

## Design

### Several boards

A Space keeps one default board, created on demand as today, and may have more. A board has a name, a prefix (letters and digits, unique in the Space ignoring case, so a ref names one ticket), an optional archive date, and a mark for the default board. The default board is the Space's first one and cannot be archived; the tools use it when no board is named. Existing tickets keep their numbers and the board's prefix and counter; each board counts its own tickets. Prefix uniqueness is checked in code in the first step, and a case-insensitive database index enforces it in the second. A ticket belongs to one board; moving a ticket to another board is not in this version. Archiving hides a board and keeps its tickets; a board is never deleted from the screen. On an archived board the tools refuse to create or update tickets, and assigning a ticket there wakes no one.

The previous release runs beside the new one for a few seconds after migrations apply, and it finds the board with a lookup that needs `spaceId` to be unique. So this ships in two steps: first a release whose code does not need the uniqueness and which adds the new columns; only then a migration that drops it, together with the screens to create, rename and archive boards. Until the second step the Space has its one board.

### Labels

A board holds an optional map from each status to a label. A status with no label shows the built-in one. The API returns the label to show for every status, and the agent tools put those labels in their results so an agent can say "In contact" to a person who named the column that. Tools and stored data always use the status key.

### Data on a ticket

A ticket holds a list of fields, each a name and a value (up to 20 fields, names of 60 characters, values of 500). People edit them in the ticket dialog; agents read them through `ticket_get` and write them through `ticket_update`, which sets a field by name and removes it when the value is empty. Fields are stored like the ticket's description. Tickets are not encrypted at rest today (only messages, events, memory, thread summaries and the wiki are), so fields are not either, and lead data in them has the same protection as the description. Encrypting ticket text is a separate change.

### What each agent is doing

A card shows its owner's name and, on tickets in progress, a working mark when that agent has a run going; the mark is about the agent, not about the one ticket the run is on. "In progress" means `doing`. The board can be filtered to one owner. On the Team screen, under each agent, the tickets it owns that are `doing`, `review` or `blocked` are listed, each opening its card. This reads data that exists; it adds no polling beyond what the screens already do.

### Telling the person

- The board signal gains what moved: the ticket's ref, title, new status, previous status and who moved it. A client can then notify without guessing.
- While the app is open, on any screen, a move to Review or Done made by an agent shows a notification ("Leo moved LEAD-2 to Review") that opens the card. A move made by a person notifies no one, and every member of the Space is told of an agent's move. The same code serves the web and the desktop app (the desktop hosts the web UI) and uses the permission the app already asks for. The board stream is per Space, so one subscription at the app's root covers every board.
- The agent's wake prompt and the ticket tools tell it: when you move a ticket to Review or Done, say so in your chat and send the Chief a one-line status with `message_bot`. The Chief is the agent created at onboarding; with no Chief, or when the agent is the Chief, nothing is sent. This is an instruction to the model, so a missed message is acceptable and never blocks the move.

Telling the Chief wakes the Chief, which is a paid run. It happens only on Review and Done, and only when an agent chose to move a card there.

### Agent tools

`board_tickets` and `ticket_create` take an optional board (by prefix, name or id) and default to the default board; with no board named, `board_tickets` also lists the boards. `ticket_get`, `ticket_update` and `ticket_comment` find a ticket by its ref, which names its board.

### Where it shows

- **Web and desktop:** the Board screen gets the board selector in its header (a menu with the board's name that lists the Space's boards), the owner filter, board settings (name, prefix, labels, archive) and the fields in the ticket dialog. The desktop app sets `TICKET_BOARD_ENABLED`. The flag's default for other installs is unchanged.
- **Team screen:** each agent's tickets, as above.
- **Mobile:** nothing in this version; the API and contracts are shared so it can follow.

## Constraints

- Public repository: fixtures use fake companies and people.
- Every migration works with the previous release's code (see the two steps above).
- The backend owns authorization and validation; screens express intent. Any member of the Space reads and writes boards, as today, which includes creating, renaming, relabelling and archiving them.
- Tests are offline and deterministic; new screens get a Playwright fixture so CI shows a screenshot.
- Every new visible string is listed in the PR with why it cannot go.

## Decisions made with the owner

- Selector in the header of the board (option B), not tabs or a side list.
- The six statuses stay; labels can be renamed per board.
- People and agents move cards; agents tell the person when something is ready.
- Web and desktop first, no mobile.
- Notifications: desktop notification, a message in the agent's chat, and a message to the Chief.
- A place for data on the ticket (read here as named fields).

## Calls I made (to check)

- Fields are a short list of name and value, not typed columns.
- Only Review and Done notify.
- The Chief is told by the agent, as an instruction, not by the server.
- Boards are archived, never deleted; a ticket cannot move between boards yet.
- The two-step migration, and creating boards only in the second step.
- The desktop app turns the board on by default.
- Settled after a fresh reader's questions: only an agent's move notifies; the Chief is the onboarding agent and is told through `message_bot`; the default board is the first one and cannot be archived; archived boards refuse tool writes; any member can archive; fields are not encrypted, like the description; "in progress" means `doing`; the working mark is per agent.

## Left to the builder

The exact shape of the board and ticket tables, the signal payload, how the owner's working mark is read, the wording of the tools' descriptions and of the agent prompt, the layout of the Team screen's list and the board settings screen.
