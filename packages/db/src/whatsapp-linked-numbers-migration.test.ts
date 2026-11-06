import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL(
    "../prisma/migrations/20261112000000_whatsapp_linked_numbers/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8");

describe("the WhatsApp linked numbers migration", () => {
  it("only adds columns and a table, so the previous release keeps working", () => {
    expect(sql).not.toMatch(/\bDROP\b|\bRENAME\b|^\s*(INSERT|UPDATE|DELETE)\b/im);
    expect(sql).not.toMatch(/ALTER COLUMN/i);
  });

  it("adds the installation columns with defaults the previous release can ignore", () => {
    expect(sql).toMatch(
      /"messaging_installations" ADD COLUMN\s+"visitorConnectors" TEXT\[\] NOT NULL DEFAULT/,
    );
    expect(sql).toMatch(
      /"messaging_installations" ADD COLUMN\s+"status" TEXT NOT NULL DEFAULT 'active'/,
    );
    expect(sql).toMatch(/"messaging_installations" ADD COLUMN\s+"pausedAt" TIMESTAMP\(3\)\s*;/);
    expect(sql).toMatch(/"messaging_installations" ADD COLUMN\s+"resumedAt" TIMESTAMP\(3\)\s*;/);
  });

  it("stores each auth entry of a number, and removes them with the number", () => {
    expect(sql).toMatch(/CREATE TABLE "whatsapp_auth_entries"/);
    expect(sql).toMatch(/PRIMARY KEY \("installationId", "name"\)/);
    expect(sql).toMatch(
      /FOREIGN KEY \("installationId"\) REFERENCES "messaging_installations"\("id"\) ON DELETE CASCADE/,
    );
  });

  it("covers the auth table with row security like the installations table", () => {
    expect(sql).toMatch(/ALTER TABLE "whatsapp_auth_entries" ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/CREATE POLICY whatsapp_auth_entries_system/);
    expect(sql).toMatch(/app\.rls_bypass/);
  });

  it("is mirrored in the Prisma schema", () => {
    expect(schema).toMatch(/model WhatsAppAuthEntry \{/);
    expect(schema).toMatch(/visitorConnectors\s+String\[\]\s+@default\(\[\]\)/);
    expect(schema).toMatch(/pausedAt\s+DateTime\?/);
    expect(schema).toMatch(/resumedAt\s+DateTime\?/);
  });
});
