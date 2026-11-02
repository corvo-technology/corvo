import { z } from "zod";
import { localizedCatalogText, STORE_CATEGORIES } from "./agent-catalog.js";

export const SKILL_STORE_ICONS = [
  "code",
  "search",
  "check",
  "mail",
  "list",
  "file",
  "money",
  "chart",
  "megaphone",
  "palette",
  "calendar",
  "users",
  "box",
] as const;

/**
 * A ready-made skill (a SKILL.md recipe) a person can install once for all their agents. The
 * names avoid accents so the `/name` and `@name` pickers match them as typed.
 */
export const SkillStoreEntrySchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  category: z.enum(STORE_CATEGORIES),
  name: localizedCatalogText(80),
  /** One line; the `/` picker shows the first 72 characters. */
  description: localizedCatalogText(120),
  body: localizedCatalogText(6000),
  icon: z.enum(SKILL_STORE_ICONS),
});
export type SkillStoreEntry = z.infer<typeof SkillStoreEntrySchema>;
