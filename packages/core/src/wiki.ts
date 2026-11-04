// The wiki's pages as plain text: what a title is, what a page links to, how it is summed up.
// Pages are Markdown with [[Title]] links and optional front matter, so a folder of them opens
// in Obsidian as it is. Nothing here touches storage.

/** Fenced and inline code, which never holds a link. */
const CODE = /```[\s\S]*?```|`[^`\n]*`/g;
const LINK = /\[\[([^\]\n]+?)\]\]/g;
const FRONT = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** Two titles are the same page when they have the same slug: no case, accents or extra spaces. */
export function wikiSlug(title: string): string {
  return title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** The page a link target names, as in Obsidian: `Clients/Alpha.md`, `[[Alpha]]` and `Alpha|label` are Alpha. */
export function wikiTitle(target: string): string {
  const named = target.trim().replace(/^\[\[|\]\]$/g, "");
  const withoutAlias = named.split("|")[0]!;
  return withoutAlias
    .replace(/\.md\s*$/i, "")
    .split("/")
    .pop()!
    .trim();
}

/** A page's file name: its title minus what file systems refuse. */
export function wikiPath(title: string): string {
  const name = title
    .replace(/[\\/:*?"<>|\n\r\t]/g, "-")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  return `${name || "untitled"}.md`;
}

/** A page's title as it is kept: no folder, no `.md`, nothing a file name refuses. Links are matched on this. */
export function wikiCanonicalTitle(target: string): string {
  return wikiPath(wikiTitle(target)).replace(/\.md$/, "");
}

/** The text with its code replaced by blanks of the same length, so offsets still line up. */
function withoutCode(body: string): string {
  return body.replace(CODE, (code) => " ".repeat(code.length));
}

/** The distinct pages a body links to, in the order they first appear, outside code. */
export function wikiLinks(body: string): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const match of withoutCode(body).matchAll(LINK)) {
    const title = wikiTitle(match[1]!);
    const slug = wikiSlug(title);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    titles.push(title);
  }
  return titles;
}

const readable = (line: string) =>
  line.replace(LINK, (_all, inner: string) => {
    const [target, label] = inner.split("|");
    return (label ?? wikiTitle(target!)).trim();
  });

/** The sentence that opens a page, which the index shows. */
export function wikiSummary(body: string): string {
  const line = body
    .split(/\r?\n/)
    .map((row) => row.trim())
    .find((row) => row && !row.startsWith("#"));
  if (!line) return "";
  const text = readable(line);
  const sentence = text.match(/^(.+?[.!?])(?:\s|$)/)?.[1] ?? text;
  return sentence.length > 160 ? `${sentence.slice(0, 159).trimEnd()}…` : sentence;
}

/** What a page is: what it states, else its folder, else Other. */
export function wikiKind(path: string, meta: Record<string, string>): string {
  const said = meta.type || meta.kind;
  if (said) return said;
  const folder = path.includes("/") ? path.split("/")[0] : "";
  return folder || "Other";
}

/** `---\nkey: value\n---\nbody`: the front matter Obsidian shows as properties. */
export function parseWikiPage(text: string): { meta: Record<string, string>; body: string } {
  const front = text.match(FRONT);
  if (!front) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const row of front[1]!.split(/\r?\n/)) {
    const at = row.indexOf(":");
    if (at > 0) meta[row.slice(0, at).trim()] = row.slice(at + 1).trim();
  }
  return { meta, body: text.slice(front[0].length).replace(/^\r?\n/, "") };
}

/** The page with `set` merged into its front matter and `body` as its text. */
export function withWikiFront(
  text: string | undefined,
  set: Record<string, string>,
  body: string,
): string {
  const meta = { ...(text ? parseWikiPage(text).meta : {}), ...set };
  const rows = Object.entries(meta).map(([key, value]) => `${key}: ${value}`);
  return rows.length ? `---\n${rows.join("\n")}\n---\n${body}` : body;
}

/**
 * Links a body for display: a title that exists becomes a Markdown link to `rook-wiki:Title`, one
 * that does not stays as its label. Code is left alone.
 */
export function linkWikiTitles(body: string, resolve: (title: string) => boolean): string {
  const parts = body.split(new RegExp(`(${CODE.source})`, "g"));
  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part;
      return part.replace(LINK, (_all, inner: string) => {
        const [target, label] = inner.split("|");
        const title = wikiTitle(target!);
        const text = (label ?? title).trim();
        if (!resolve(title)) return text;
        const url = encodeURIComponent(title).replace(/\(/g, "%28").replace(/\)/g, "%29");
        return `[${text}](rook-wiki:${url})`;
      });
    })
    .join("");
}
