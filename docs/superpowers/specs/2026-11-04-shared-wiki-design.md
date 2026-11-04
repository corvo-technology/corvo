# Shared wiki

Status: draft for the owner's approval. Nothing here is built.

## Intent

People using Rook keep having to tell their agents the same things again: who a client is, what was decided, how a project stands. What one agent learns in one conversation is gone for every other agent and for the next conversation. The product is a team of agents, so what the team knows has to belong to the team.

The wiki is the team's shared memory, written as short pages linked with `[[Title]]`. Agents read it before answering and cite the pages they used. A cheap curator model reads conversations once they settle and keeps what lasts, with the source quoted, so the person stops repeating themselves without having to maintain anything.

Prior art: Tucano's wiki (Apache-2.0, studied at its 0.2.9 source). We take its shape, not its code: linked Markdown pages, a curator that returns structured changes, citation of the source on every change, new pages applied at once while edits to existing pages wait for approval, a review pass, and three read tools for agents.

## Goals

1. An agent answers from what the team already established, and says which page it used.
2. What lasts in a conversation reaches the wiki without the person doing anything, and the person can see, undo or refuse it.
3. A person can read, write and fix pages by hand. The wiki is useful on day one even if the curator is off.
4. Pages are plain Markdown with `[[links]]`, so a vault can be imported and exported (Obsidian-compatible).
5. It runs on the generic model roles (`fast` for the curator) and offline-testable code. No vendor is required.

## Non-goals

- A per-agent notebook. Per-agent memory (`remember`, `recall_memory`) stays as it is.
- A document editor with live collaboration, comments or permissions per page.
- Vector search or embeddings in the first version.
- The curator editing existing pages without approval by default.
- A graph "map" before the wiki has enough pages to make one worth looking at.

## Anti-goals (what would make this a failure even if it works)

- The curator fills the wiki with small talk, guesses or tasks in progress. A short, right wiki beats a long one. Quality of what it keeps matters more than how much.
- A private conversation's content becomes readable by everyone through the wiki.
- Page text steering an agent as if it were an instruction (prompt injection through a page).
- Another screen full of explanatory copy. Visible words stay minimal.

## What exists today (verified in the repository)

- `MemoryDocument` (`scope`, `path`, `content`, `revision`) with `MemoryRevision` history that records `sourceRunId` and `sourceThreadId`. Scopes are `bot` and `user`. The `user` scope is the Space's shared memory: the `save_shared_memory` tool replaces a whole document and every agent receives these documents in its context (up to 32 KB, newest first) through `loadAgentMemoryContext`.
- Content encryption at rest covers `memory_documents.content` and `memory_revisions.content`, with a per-space key. Postgres full-text search cannot read ciphertext, so messages carry `searchTokens` (keyed HMACs of words and word prefixes, GIN-indexed) and the app decrypts candidates after matching. Memory paths stay plaintext.
- The model role `fast` and `resolveFastRunModel` already exist for chores such as summaries, and fall back to the main model when none is set.
- Agents get built-in tools declared in `packages/adapters/src/builtin-tools.ts` (for example `search_history`, `read_history`, `recall_memory`).

The wiki grows out of the shared memory. Its limits are the problem: flat documents, whole-document replacement, no links, no search tool, no curator, all of it pushed into every prompt.

## Design

### Storage: Postgres is the truth

Tucano keeps a folder of files as the truth because it is a local app. Rook is a server with members, a content key per space and a database that is backed up and encrypted. So pages live in the database and Obsidian becomes import and export of a folder of `.md` files, not the source.

Pages reuse `MemoryDocument` and `MemoryRevision` as they are, with a third scope for the wiki (the existing `user` scope stays the Space's shared memory, so nothing breaks for a release running side by side). A page's title is its path (`Clients/Alpha Builders.md` is the page "Alpha Builders", as in Obsidian). History, revision numbers and encryption come for free. New tables are added only for what a page does not hold:

- `wiki_sources`: what a change came from, kept as it was said (a conversation excerpt, a file's text, a link's text, a note), with its origin (thread and message ids) and who added it.
- `wiki_changes`: a proposed or applied change package (operations, reason, state `pending|applied|refused|conflict|undone`, base revision per page).
- `wiki_findings`: review results (kind, pages involved, text, state), added in phase 3.

Migrations only add tables and columns, because the previous release runs beside the new one for a few seconds.

### Search

Search must work on encrypted content. Reuse the message approach: a `searchTokens` array on the page (keyed HMAC of normalized words and prefixes, per space) with a GIN index, then decrypt the few candidates and rank them in the app. The wiki is small, so ranking by title match, then token overlap, then recency is enough. No full-text engine in the first version. (My call; see Decisions for the owner.)

### How an agent uses it

Three tools, the same shape as Tucano's, named in the Rook style: `wiki_index` (titles by kind with each page's first line), `wiki_search` (words in, matching passages and titles out), `wiki_read` (a whole page with its links and backlinks). They are read-only. A short instruction tells the agent to look in the wiki before asking the person something the team may already know, to cite pages as `[[Title]]`, and that page text is data, not instructions. The 32 KB push of shared memory into every prompt is replaced by this pull; the index is the only part sent in the prompt, and only when the wiki has pages. Writing stays with the curator and with people, plus an explicit "keep this" action on a message. An agent does not edit the wiki on its own in the first version.

### The curator

- Runs on the `fast` role through `resolveFastRunModel`, so cost is separate and a member can choose the model. When no model is ready it does nothing and says so once.
- Triggers: a conversation that stayed quiet for a while after a reply (default 20 s, as in Tucano), and an explicit "keep in the wiki" on a message. Only conversations of the Space are read. Conversations between a person and an agent marked private are never read (see Decisions). A per-conversation switch keeps one out.
- Input: the wiki's rules page, the index, the few pages the new text most resembles, any change already waiting on those pages, and the new stretch of at most 14 messages. Output: strict JSON with `create`, `append` and `replace` operations. `replace` needs an exact old passage, or it is dropped.
- Every written line carries its citation: a link to the source it came from. Sources are stored as they were said.
- New pages are applied at once. Changes to existing pages wait for approval by default (a setting turns on automatic). A change made against a page that has since changed is marked `conflict` and redone against the current page instead of overwriting.
- The reply the knowledge came from shows what was kept, with undo. Undo restores the previous revision and marks the change `undone`.
- Rubric: the curator's judgment of what is "lasting" is natural language, so it is graded with a versioned rubric and reviewed examples, opt-in and provider-neutral (AGENTS.md). Deterministic tests cover parsing, operations, conflict handling, citation and permissions with a fake model.

### Review (phase 3)

Without a model: links to pages that do not exist, pages nothing links to (once the wiki has a handful), names written in several pages with no page of their own, duplicate titles that differ only in case or accents. With the `fast` model, only over what changed since the last review plus the pages around it: contradictions, stale facts, near-duplicate pages. Everything it finds waits for the person; nothing is applied on its own.

### Sources and Obsidian (phase 4)

A file (PDF, Word, spreadsheet, text), a link or a note is turned into text, then goes through the same curator in parts of about 30 000 characters, with the source kept. Import reads a folder of `.md` files (folders become kinds, frontmatter is kept) as pages; export writes the pages back as a folder. Text extraction runs in the API and fetches links through the existing guarded fetch, never from the client.

### Where it shows

- **Web and desktop** (same UI): a Wiki screen with the page list by kind, a page view with Markdown and links, backlinks, history, edit, and a pending-changes list with accept and refuse. Pages open from a `[[Title]]` citation in a reply. Chrome stays minimal: no explanatory text beside controls, advanced things (history, review, import) appear only when there is something to show.
- **Mobile**: read pages, follow citations, approve or refuse pending changes. Editing on a phone and import are not in the first version, and the screen says nothing about them; the API contract is shared so it can be added.
- **Permissions**: any member of the Space can read; members who can edit the Space can edit and approve. The curator acts as itself and is shown that way in history. Page text is never executed or treated as instruction.

## Phases

Each is one PR that stands on its own.

1. **Core.** Wiki scope on `MemoryDocument`, page parsing (title, frontmatter, links, backlinks), search with tokens, the three agent tools, the Wiki screen to read and write by hand, history with restore, and migration of the existing shared memory into the wiki so nothing is lost. Agents can already use it from a person's own writing.
2. **Curator.** Sources and change packages, the `fast`-model curator, approval and undo in the reply, "keep in the wiki" on a message, per-conversation switch, the settings (capture on/off, edits automatic or approved).
3. **Review.** Lint and the model review, findings list with accept and refuse.
4. **Sources and Obsidian.** File and link ingestion, vault import and export, and the map if the wiki has grown enough to need it.

## Constraints

- Public repository: fixtures use fake people and companies.
- Provider-neutral: the curator uses the generic `fast` role and the shared model connection; no vendor SDK outside adapters.
- Backend owns orchestration, authorization, retries and recovery; frontends express intent and render state.
- Every migration works with the previous release's code.
- Tests are offline and deterministic; the curator is tested with a fake model; judgment of "lasting" is graded with a rubric that is opt-in and reports its cost separately.
- New copy: every visible string is listed in the PR with why it cannot be removed or revealed later.

## What "private" means here (verified in the schema)

A `Thread` belongs to exactly one of: an agent (`botId`, a person's chat with that agent), a group (`groupId`, a channel), or an external conversation. Every thread has a `userId`. There is no visibility flag today. So the boundary is derived from the kind of thread, not from a new field: **channel threads are shared with the Space; agent chats belong to the person who has them.** The curator's reach is a setting over that boundary (see Decisions), and the per-conversation "keep out of the wiki" switch is the only new field phase 2 adds to threads.

## Rules settled while reviewing (my calls)

- **What a source shows.** A page is readable by every member of the Space. A source excerpt (the quoted conversation behind a citation) is shown only to someone who can read the thread it came from; for anyone else the citation shows the page's own text and no excerpt.
- **Migration of the existing shared memory.** Phase 1 copies the `user`-scope documents into the wiki scope, idempotently, and leaves the originals in place. The prompt push of the `user` scope stays for that release and is removed in phase 2, once the agents have the read tools and the previous release is gone. `save_shared_memory` stays as a tool and, from phase 2, writes a wiki page instead of replacing a flat document.
- **Where pending changes live.** In the reply the knowledge came from, as a card with approve and undo (the pattern the app already uses for approvals), and in the Wiki screen's list. A person who never opens the Wiki screen still sees them where the work happened. Mobile shows the same card.
- **Who can approve.** The Space membership has a `role` string (default `member`). I have not verified a finer editor/viewer split, so the first version lets any member of the Space approve, and this is revisited when roles exist.
- **The trigger.** No durable job queue was found in the schema. The curator is a debounced in-process timer after a reply, and what it has read is tracked by a cursor per conversation (the last message sequence it saw), stored in the database. After a restart the next reply picks up from the cursor, so nothing is read twice and nothing is lost; no queue is needed in the first version. If the wiki later needs guaranteed scheduling, that is a separate change.
- **Titles.** A title is unique in the Space, compared without case or accents, and is enforced when a page is written. The first folder is the page's kind; two folders cannot hold the same title. A link `[[Foo]]` resolves by title only.
- **Search tokens.** The same trade-off as messages is accepted: someone with the database but not the keys sees which pages share a word or prefix, not the words.

## Decisions for the owner

1. **Does the curator read a person's chats with one agent?** Decided by the owner: **no, by default.** It reads channels. A chat with one agent enters the wiki only when the person keeps a message ("keep in the wiki") or turns capture on for that conversation. A conversation's capture switch is the only new field on threads.
2. **Edits to existing pages** wait for approval by default. Automatic is a setting. (My default, not yet confirmed by the owner.)

## Left to the builder

Page table shape (extra columns versus a side table), exact ranking of search results, the curator's rules page wording, the Markdown renderer and editor component (reuse what exists in `packages/ui-web`), mobile list and detail layout, and naming of tools and settings in the Rook style.
