# DESIGN.md: Rook

> Living design brief for the web and desktop app (mobile follows its own native rules).
> Read order: tokens in code (`packages/ui-tokens`, `packages/ui-web/src/styles.css`), then this file.
> This file records intent and decisions. When it disagrees with the code, the code is what ships.

## 1. Product truth

- **Users:** people who give work to a team of bots and are mostly not technical: owners of small businesses and teams, on a laptop or a phone.
- **Purpose:** hand work to bots, see what they did, and stay in control of what they may do.
- **Constraints:** English, Brazilian Portuguese and Spanish only, every message translated. Public repository, so no private data in any screen or example. Works offline and self-hosted: no screen may need a hosted font, icon or image service.
- **Success means:** a new person connects what they need and gets a first useful result without reading documentation. Anything a person must learn before their first result is a defect.

## 2. Design Read and surface types

Reading this as: the Rook app for people who are not technical, a dark-first, monochrome language with one green, on React, Tailwind and shadcn (Base UI).

| Surface | Type | V | M | D |
|---|---|---|---|---|
| Dashboard, chat, settings | operate | 3 | 4 | 5 |
| Agent mascots (inside those screens) | operate | 4 | 5 | 5 |
| First-run onboarding | operate | 4 | 4 | 3 |
| Marketing site (`apps/www`) | persuade | 7 | 5 | 3 |

The dashboard is less dense than a typical operate surface on purpose: the audience is new to the product.

## 3. Visual direction and project bans

- Monochrome. Ink and paper do the work; **green is the only identity color**, and bots carry their own colors.
- Quiet by default: hairline borders, no decorative gradients, no glow, no stock illustration.
- Names beat icons. An icon alone is never the only way to learn what something is.
- Progressive disclosure: advanced controls sit behind "Advanced", never in the first screen.
- Bans: no hardcoded product hex in components (use semantic tokens); no `[var(--…)]` arbitrary values; no third-party shadcn registries; no font, icon or script loaded from a third party.

## 4. Color tokens

Semantic tokens live in `@corvo/ui-tokens` (one TypeScript source generates `tokens.css`). Components use the names, never the values.

```design-tokens
fonts: Instrument Sans, ui-monospace
colors: #0b0b0c, #151517, #19191c, #f5f5f5, #3fd6a8, #ff6463, #00ba69, #e28600, #ffffff, #f2f2f2, #1c1c1c, #0a0a0a, #0b7a5a, #cd2834, #00854a, #aa6300
radii: 0.75rem, 9999px
```

| Token | Dark | Light | Job |
|---|---|---|---|
| `--background` | `#0b0b0c` | `#ffffff` | page |
| `--card` | `#151517` | `#f2f2f2` | raised surface |
| `--dialog` | `#19191c` | `#ffffff` | dialogs and menus |
| `--foreground` | `#f5f5f5` | `#1c1c1c` | text |
| `--primary` | `#3fd6a8` | `#0a0a0a` | the main action and the current state only |
| `--destructive` | `#ff6463` | `#cd2834` | errors and deletion |
| `--success` / `--warning` | `#00ba69` / `#e28600` | `#00854a` / `#aa6300` | status |

The theme follows the system unless the person chooses one.

## 5. Typography

- Text: Instrument Sans, bundled with the app (one variable file, weights 400 to 700). The system font is the fallback. Why: it is the typeface of the landing page, so the two read as one product.
- Mono: the system monospace, for code and credentials.
- Scale: 11, 12, 13, 14 (body), 17, 22, 26 pixels, defined as tokens (`text-caption` to `text-heading1`). New text uses a token, not a raw size.
- Titles balance (`text-balance`), descriptions do not widow (`text-pretty`).

## 6. Spacing and layout

- Radius by role: controls 0.5rem to 0.75rem, cards and containers 0.75rem to 1rem, avatars and pills round.
- The main navigation bar is 76 pixels wide; every item has a name under its icon.
- One idea per screen in onboarding; settings groups, not walls of controls.

## 7. Components

- Kit: shadcn on Base UI, vendored in `packages/ui-web`. Reuse before writing chrome by hand.
- A choice with consequences is a set of cards that each say what they do (Approvals), not a bare selector.
- A switch is for a setting that is on or off; a choice among three or more is cards or a select.
- Destructive actions use the destructive token and say what is deleted.

## 8. Motion

Short and functional: 150 to 200 milliseconds for hover and press, `opacity` and `transform` only, and everything guarded by `prefers-reduced-motion`. Nothing animates on first load for decoration.

## 9. Imagery and content

- Words: plain and specific, no jargon a person would have to look up. Every visible word is UI: remove first, reveal only when relevant.
- A new visible word in a pull request is quoted there, with why it is needed.
- Bots are shown by their avatar and name together.
- Anything a bot says to a person is in the person's language.

## 10. Do / Don't

| Do | Don't |
|---|---|
| Show the name next to the icon | Make people hover to learn what a control is |
| Explain a consequential choice in one sentence | Explain a control that already explains itself |
| Put the safe option first | Default to the most powerful option |
| Keep one green for the main action | Add a second accent |
| Ship all three languages complete | Let a screen fall back to English |

## 11. Decision log

- **2026-10-31, typeface:** the app moves from the system font to Instrument Sans, the landing page's typeface (PR 71). Why: the dashboard and the landing read as different products.
- **2026-10-31, navigation:** names under the icons in the main bar (PR 73). Why: five anonymous glyphs forced people to hover.
- **2026-10-31, approvals:** the three modes become cards with one sentence each, safest first (PR 72). Why: the setting that decides whether a bot acts alone looked like a footnote.

- **2026-11-01, motion up to M4:** the dashboard may react to what happens: mascots hop on hover, rows slide when the list reorders, new messages and starter buttons rise in. Limits unchanged: 150 to 200 milliseconds, `opacity` and `transform` only, off for `prefers-reduced-motion`, and history never animates on load.
- **2026-11-01, starters:** an empty chat offers up to four tappable first messages the agent defines. Why: an empty screen with only a composer gave no way in.

- **2026-11-01, empty chat and navigation:** an empty chat introduces the agent (a large mascot, its name and role) before its starters. Moving between areas never replaces the whole screen with a loader: only the content area waits, and the areas are fetched once the app is idle. A partner's frame may take its main colour from the partner (`accent`), which replaces only the primary tokens.

- **2026-11-01, mascots with moving eyes:** the mascot picture is now the same art without its eyes (`apps/web/public/mascot/<color>-blank.webp`, made by filling the eye areas of the original in from the surrounding body), and the eyes are drawn over it as vectors. They follow the pointer, blink on a beat of their own per agent, scan while the agent works, widen when it waits for the person, squint after a failure and smile for a moment when work ends. Why: a static picture gave the list no life, and the eyes are the one place the identity of an agent can react. Limits: transform only, off for `prefers-reduced-motion`, one pointer listener for the whole page, nothing for touch screens. The original art stays for places that show a still picture.
- **2026-11-01, mascot tile and quiet list:** the mascot's tile takes a wash of its own colour over the card instead of near-black, so a list reads as colours in either theme (the picture is a bust cropped at the base, so the tile stays). A row's time shows on the open chat, an unread one and the row under the pointer.

## 12. References

- Landing page: `apps/www`. Tokens: `packages/ui-tokens`. Component kit: `packages/ui-web`.
- Project rules that shape every screen: `AGENTS.md`.
