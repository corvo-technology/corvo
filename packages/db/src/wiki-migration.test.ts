import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("the wiki migration", () => {
  it("only adds columns and indexes, and copies no data", () => {
    const sql = readFileSync(
      new URL("../prisma/migrations/20261107000000_wiki_pages/migration.sql", import.meta.url),
      "utf8",
    );
    // A release running beside this one must never meet a row it does not know: shared memory is
    // brought into the wiki at run time, after the previous release is gone.
    expect(sql).not.toMatch(/\b(insert|update|delete|drop|rename)\b/i);
    expect(sql).toMatch(/ADD COLUMN "slug"/);
    expect(sql).toMatch(/ADD COLUMN "searchTokens"/);
  });
});
