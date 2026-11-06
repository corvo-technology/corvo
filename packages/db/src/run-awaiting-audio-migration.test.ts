import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("../prisma/migrations/20261111000100_run_awaiting_audio/migration.sql", import.meta.url),
  "utf8",
);

describe("the run awaiting audio migration", () => {
  it("only adds a nullable column, and copies no data", () => {
    // The previous release runs beside this one for a few seconds after migrations apply.
    expect(sql).toMatch(/ALTER TABLE "runs" ADD COLUMN\s+"awaitingAudioAt" TIMESTAMP\(3\)\s*;/);
    expect(sql).not.toMatch(/\b(insert|update|delete|drop|rename)\b/i);
    expect(sql).not.toMatch(/NOT NULL/i);
  });
});
