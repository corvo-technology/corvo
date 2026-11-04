import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../prisma/migrations/20261108000000_wiki_curator/migration.sql", import.meta.url),
  "utf8",
);

describe("the wiki curator migration", () => {
  it("only adds tables and columns, and copies no data", () => {
    // The previous release runs beside this one for a few seconds after migrations apply.
    expect(sql.replace(/ON (DELETE|UPDATE) CASCADE/g, "")).not.toMatch(
      /\b(insert|update|delete|drop|rename)\b/i,
    );
    expect(sql).toMatch(/CREATE TABLE "wiki_settings"/);
    expect(sql).toMatch(/CREATE TABLE "wiki_sources"/);
    expect(sql).toMatch(/CREATE TABLE "wiki_changes"/);
    expect(sql).toMatch(/ADD COLUMN\s+"wikiCuratedUpToSeq"/);
    expect(sql).toMatch(/ADD COLUMN\s+"wikiCapture"/);
  });

  it("puts every new table behind row-level security", () => {
    for (const table of ["wiki_settings", "wiki_sources", "wiki_changes"]) {
      expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      expect(sql).toContain(`CREATE POLICY ${table}_tenant ON "${table}"`);
      expect(sql).toContain(`CREATE POLICY ${table}_system ON "${table}"`);
    }
  });
});
