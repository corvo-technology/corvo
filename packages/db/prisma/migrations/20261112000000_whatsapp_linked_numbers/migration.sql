-- Additive: the previous release neither reads nor writes these columns or this table.
ALTER TABLE "messaging_installations" ADD COLUMN "visitorConnectors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "messaging_installations" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "messaging_installations" ADD COLUMN "pausedAt" TIMESTAMP(3);
ALTER TABLE "messaging_installations" ADD COLUMN "resumedAt" TIMESTAMP(3);

CREATE TABLE "whatsapp_auth_entries" (
    "installationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_auth_entries_pkey" PRIMARY KEY ("installationId", "name")
);

ALTER TABLE "whatsapp_auth_entries" ADD CONSTRAINT "whatsapp_auth_entries_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "messaging_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A linked number's session is a secret: only the system role reads it, never a tenant query.
ALTER TABLE "whatsapp_auth_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_auth_entries_system ON "whatsapp_auth_entries"
  USING (current_setting('app.rls_bypass', true) = 'on');
