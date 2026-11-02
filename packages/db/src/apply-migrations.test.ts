import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applyMigrationsFromDir, readMigrations } from "./apply-migrations.js";

const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function migrationsDir(files: Record<string, string | null>) {
  const root = await mkdtemp(path.join(tmpdir(), "corvo-migrations-"));
  dirs.push(root);
  for (const [name, sql] of Object.entries(files)) {
    await mkdir(path.join(root, name));
    if (sql !== null) await writeFile(path.join(root, name, "migration.sql"), sql);
  }
  await writeFile(path.join(root, "migration_lock.toml"), 'provider = "postgresql"\n');
  return root;
}

describe("readMigrations", () => {
  it("returns migrations in name order with the checksum Prisma records", async () => {
    const root = await migrationsDir({
      "20260102000000_second": "SELECT 2;\n",
      "20260101000000_first": "SELECT 1;\n",
    });
    const migrations = await readMigrations(root);
    expect(migrations.map((migration) => migration.name)).toEqual([
      "20260101000000_first",
      "20260102000000_second",
    ]);
    expect(migrations[0]?.checksum).toBe(createHash("sha256").update("SELECT 1;\n").digest("hex"));
  });

  it("skips folders without a migration.sql and the lock file", async () => {
    const root = await migrationsDir({
      "20260101000000_empty": null,
      "20260102000000_real": "SELECT 1;",
    });
    expect((await readMigrations(root)).map((migration) => migration.name)).toEqual([
      "20260102000000_real",
    ]);
  });

  it("fails clearly when the folder does not exist", async () => {
    await expect(readMigrations("/nonexistent/corvo-migrations")).rejects.toThrow(
      "Migrations folder not found",
    );
  });
});

describe("applyMigrationsFromDir", () => {
  it("rejects a connection string that is not a database URL", async () => {
    const root = await migrationsDir({ "20260101000000_first": "SELECT 1;" });
    await expect(applyMigrationsFromDir("not a url", root)).rejects.toThrow();
  });
});
