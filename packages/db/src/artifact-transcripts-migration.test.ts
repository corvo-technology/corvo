import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROW_SECURITY_MODELS } from "./row-security.js";

const sql = readFileSync(
  new URL(
    "../prisma/migrations/20261111000000_artifact_transcripts/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("the artifact transcripts migration", () => {
  it("only adds a table, and copies no data", () => {
    // The previous release runs beside this one for a few seconds after migrations apply.
    expect(sql.replace(/ON (DELETE|UPDATE) CASCADE/g, "")).not.toMatch(
      /\b(insert|update|delete|drop|rename)\b/i,
    );
    expect(sql).toMatch(/CREATE TABLE "artifact_transcripts"/);
  });

  it("puts the table behind row-level security, as every tenant table is", () => {
    expect(sql).toContain('ALTER TABLE "artifact_transcripts" ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('CREATE POLICY artifact_transcripts_tenant ON "artifact_transcripts"');
    expect(sql).toContain('CREATE POLICY artifact_transcripts_system ON "artifact_transcripts"');
    expect(ROW_SECURITY_MODELS.has("ArtifactTranscript")).toBe(true);
  });

  it("goes away with its artifact and its space", () => {
    expect(sql).toMatch(/"artifact_transcripts_artifactId_fkey".*ON DELETE CASCADE/);
    expect(sql).toMatch(/"artifact_transcripts_spaceId_fkey".*ON DELETE CASCADE/);
  });
});
