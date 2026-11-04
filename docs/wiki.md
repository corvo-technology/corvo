# Wiki

A space's wiki is what its team knows, written as short pages that link to each other with
`[[Title]]`. Agents look in it before asking you something the team already knows, and cite the
pages they used. You can read, write, fix and restore pages yourself, on the web, in the desktop
app and (read only) on a phone.

## Where pages live

Pages are memory documents with the scope `wiki`, so they are stored, encrypted and versioned like
the rest of memory (see [content encryption](./content-encryption.md)). A page's title is its
file name without `.md`, as in Obsidian: `[[Clients/Alpha.md]]`, `[[Alpha]]` and `[[Alpha|them]]`
all point to the page **Alpha**. Titles are unique in a space, compared without case or accents,
so `Café` and `cafe` are one title; writing a page under a second spelling is refused.

A page is Markdown with optional front matter (`type: Person`). Its kind, shown in the list, is
its `type`, else its folder, else `Other`. Every save keeps the text it replaces as a revision, and
restoring one writes it as a new revision.

A save that names a revision the page has moved on from is refused, so a newer edit is never
overwritten by a stale one.

## Who can read and write

Every member of the space reads and writes the wiki. Pages belong to the space, not to the person
who wrote them. A person's chats with one agent stay theirs; nothing in this first version copies
them into the wiki.

## What agents can do

Agents have three read-only tools:

| Tool | What it does |
| --- | --- |
| `wiki_index` | Lists the pages by kind, each with its first sentence. |
| `wiki_search` | Finds pages by words (the start of a word is enough, accents do not matter) and returns the matching passages. |
| `wiki_read` | Opens one page whole, with the pages it links to and the pages that cite it. |

`wiki_search` and `wiki_read` are always offered; `wiki_index` is found through `find_tool`. A run
is also told, in its prompt, how to use the wiki and given an index of up to 8 KB. Page text is
written by people and agents, so it reaches a run as data, never as instructions, and a run that
reads it is treated like one that read any other outside text. Runs that answer a messaging
channel get no wiki tools and no index.

Agents do not write to the wiki in this version.

## Shared memory

A space's earlier shared memory (the documents every agent of a person reads) is copied into the
wiki as pages the first time the wiki is opened, once per person. The originals stay where they
are and keep being sent to agents for now. A title the wiki already has is not replaced, and a
page you delete afterwards stays deleted.

## Limits

- Up to 2 000 pages are read at once for the index, links and citations. A page past that is still
  found and opened by its title, but is not listed or counted. The index a run is given is built
  again only when the wiki has changed.
- A page's history shows its newest 100 revisions.
- A page holds up to 200 000 characters.
- Search matches whole words and word beginnings, ignoring case and accents. It does not search
  the middle of a word.
