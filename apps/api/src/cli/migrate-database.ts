// `pnpm db:migrate`: schema migrations, the job queue schema, then the runtime
// login. Everything here runs as the migration (owner) role; the API and worker
// then connect with DATABASE_URL and only get the runtime grants.
import { execFileSync } from "node:child_process";
import { migrateJobQueue } from "@corvo/adapters";
import { loadRootEnv } from "@corvo/core/node/load-root-env";
import {
  applyMigrationsFromDir,
  databaseUrls,
  provisionRuntimeRole,
  RUNTIME_ROLE,
  SINGLE_DATABASE_URL_WARNING,
} from "@corvo/db";

loadRootEnv();
const urls = databaseUrls(process.env);
// The desktop app has no pnpm or Prisma CLI, so it points at its bundled migration files.
const bundledMigrations = process.env.MIGRATIONS_DIR?.trim();
if (bundledMigrations) {
  const applied = await applyMigrationsFromDir(urls.migrationUrl, bundledMigrations);
  process.stdout.write(`Applied ${applied.length} migration(s).\n`);
} else {
  execFileSync("pnpm", ["--filter", "@corvo/db", "exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_MIGRATION_URL: urls.migrationUrl },
  });
}
await migrateJobQueue(urls.migrationUrl);

if (!urls.separate) {
  process.stderr.write(`WARNING: ${SINGLE_DATABASE_URL_WARNING}\n`);
} else {
  const { warning } = await provisionRuntimeRole(urls.migrationUrl, urls.url);
  if (warning) process.stderr.write(`WARNING: ${warning}\n`);
  else process.stdout.write(`Runtime login is ready (member of ${RUNTIME_ROLE}).\n`);
}
