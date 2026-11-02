/**
 * Renders the social image for each language from the dev-only /og-preview route.
 * Run the dev server first (`pnpm --filter @corvo/www dev`), then:
 *   node apps/www/scripts/generate-og.mjs [baseUrl]
 * English is og-image.png (the default for every page); other languages are og-image-<locale>.png.
 */
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { resolveWwwPort } from "../www-port.mjs";

const LOCALES = ["en", "pt", "de", "ko", "zh", "ja"];
const baseUrl = process.argv[2] ?? `http://127.0.0.1:${resolveWwwPort()}`;
const publicDir = fileURLToPath(new URL("../public/", import.meta.url));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const locale of LOCALES) {
    await page.goto(`${baseUrl}/og-preview/${locale}/`, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "astro-dev-toolbar { display: none !important; }" });
    await page.evaluate(() => document.fonts.ready);
    const name = locale === "en" ? "og-image.png" : `og-image-${locale}.png`;
    await page.locator("#og").screenshot({ path: `${publicDir}${name}` });
    console.log(`wrote public/${name}`);
  }
} finally {
  await browser.close();
}
