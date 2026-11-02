// Bundles the local engine the desktop app runs on this computer: the API, the worker and the
// database migrations, so an installed app needs neither Docker nor a checkout. The output goes
// into dist/, which is packed into the app. Packages with native code or data files stay external
// and resolve from the app's own dependencies (`koffi` and `jsdom` are declared in its package.json).
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..", "..");
const out = path.resolve(here, "..", "dist", "engine");

/** koffi loads a native module and jsdom reads data files next to itself; neither survives bundling. */
const EXTERNAL_PACKAGES = ["koffi", "jsdom"];

// `punycode/` (with the slash) is the npm package, not the deprecated builtin.
const builtins = builtinModules.filter((name) => name !== "punycode");
const entryPoints = {
  api: path.join(root, "apps/api/src/index.ts"),
  worker: path.join(root, "apps/worker/src/index.ts"),
  migrate: path.join(root, "apps/api/src/cli/migrate-database.ts"),
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// One build with code splitting, so what the three programs share is bundled once.
await build({
  entryPoints,
  outdir: out,
  outExtension: { ".js": ".mjs" },
  chunkNames: "chunks/[name]-[hash]",
  splitting: true,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  conditions: ["node", "module"],
  // Prefer a package's ES module build: a dynamic import of its CommonJS build loses the named exports.
  mainFields: ["module", "main"],
  logLevel: "warning",
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
  // pi-ai loads its sign-in flows with variable imports that esbuild cannot follow.
  inject: [path.join(root, "packages/adapters/src/pi-bundled-oauth.ts")],
  external: [...EXTERNAL_PACKAGES, ...builtins, ...builtins.map((name) => `node:${name}`)],
});

cpSync(path.join(root, "packages/db/prisma/migrations"), path.join(out, "migrations"), {
  recursive: true,
});
