import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL(
    "../prisma/migrations/20261110000000_board_labels_and_fields/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("the board labels and ticket fields migration", () => {
  it("only adds columns, so the previous release keeps working beside it", () => {
    expect(sql).not.toMatch(/\b(insert|update|delete|drop|rename)\b/i);
    expect(sql).toMatch(/ALTER TABLE "boards" ADD COLUMN\s+"statusLabels" JSONB/);
    expect(sql).toMatch(/ALTER TABLE "tickets" ADD COLUMN\s+"fields" JSONB/);
  });
});
