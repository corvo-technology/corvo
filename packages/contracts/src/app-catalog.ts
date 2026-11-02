import { z } from "zod";

export const APP_CATEGORIES = ["coding", "productivity", "data", "design", "automation"] as const;
export type AppCategory = (typeof APP_CATEGORIES)[number];

const HttpsUrl = z
  .string()
  .max(2048)
  .url()
  .refine((value) => value.startsWith("https://"), "Must be an https URL");

/** A remote MCP app a person can add in one step. The auth block says how it signs in. */
export const AppCatalogEntrySchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  name: z.string().trim().min(1).max(120),
  tagline: z.string().trim().min(1).max(120),
  category: z.enum(APP_CATEGORIES),
  iconUrl: HttpsUrl,
  featured: z.boolean(),
  /** The provider accepts only a loopback sign-in redirect, which only the desktop app can receive. */
  desktopOnly: z.boolean().optional(),
  endpoint: HttpsUrl,
  transport: z.enum(["streamable_http", "sse"]),
  auth: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("oauth") }),
    z.object({ kind: z.literal("none") }),
    z.object({
      kind: z.literal("key"),
      header: z.string().regex(/^[A-Za-z0-9-]+$/),
      scheme: z.enum(["bearer", "raw"]),
      label: z.string().trim().min(1).max(60),
      hint: z.string().trim().min(1).max(200),
      docsUrl: HttpsUrl,
    }),
  ]),
  prompts: z.array(z.string().trim().min(1).max(200)).max(3),
});
export type AppCatalogEntry = z.infer<typeof AppCatalogEntrySchema>;
