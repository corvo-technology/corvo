import * as z from "zod";
import { IsoDate } from "./ids.js";

/** The longest page body that can be written, in characters. */
export const WIKI_BODY_MAX = 200_000;

/** A page's title: something a person can read, with a letter or a digit in it. */
export const WikiTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/[\p{L}\p{N}]/u, "A title needs a letter or a digit");

export const WikiPageInfoSchema = z.object({
  title: z.string(),
  path: z.string(),
  kind: z.string(),
  summary: z.string(),
  revision: z.number().int(),
  updatedAt: IsoDate,
});
export type WikiPageInfo = z.infer<typeof WikiPageInfoSchema>;

export const WikiPageSchema = WikiPageInfoSchema.extend({
  body: z.string(),
  /** Pages this one links to. */
  links: z.array(z.string()),
  /** The links that name no page yet. */
  missing: z.array(z.string()),
  /** Pages that link to this one. */
  backlinks: z.array(z.string()),
});
export type WikiPage = z.infer<typeof WikiPageSchema>;

export const WikiHitSchema = z.object({
  title: z.string(),
  kind: z.string(),
  snippet: z.string(),
});
export type WikiHit = z.infer<typeof WikiHitSchema>;

export const WikiRevisionSchema = z.object({
  revision: z.number().int(),
  at: IsoDate,
  bytes: z.number().int(),
});
export type WikiRevision = z.infer<typeof WikiRevisionSchema>;

export const WikiWriteInputSchema = z.object({
  title: WikiTitleSchema,
  body: z.string().max(WIKI_BODY_MAX),
  /** The revision the writer saw; the write is refused when the page has moved on. */
  expectedRevision: z.number().int().positive().optional(),
});
export type WikiWriteInput = z.infer<typeof WikiWriteInputSchema>;
