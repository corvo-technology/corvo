-- AlterTable
ALTER TABLE "partners" ADD COLUMN "template" JSONB;

-- CreateTable
CREATE TABLE "partner_request_windows" (
    "partnerId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "partner_request_windows_pkey" PRIMARY KEY ("partnerId","windowStart")
);

-- AddForeignKey
ALTER TABLE "partner_request_windows" ADD CONSTRAINT "partner_request_windows_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- System-only, like the other partner tables.
ALTER TABLE "partner_request_windows" ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_request_windows_system ON "partner_request_windows"
  USING (current_setting('app.rls_bypass', true) = 'on');

-- Credit rows belong to an organization. A session acting for one space sees only its own
-- organization's rows. Server code with no space or the system bypass (webhooks, the worker)
-- keeps its access, because it authenticates separately and spans organizations.
ALTER TABLE "model_credit_accounts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY model_credit_accounts_org ON "model_credit_accounts"
  USING (
    NULLIF(current_setting('app.space_id', true), '') IS NULL
    OR current_setting('app.rls_bypass', true) = 'on'
    OR "organizationId" = (SELECT s."organizationId" FROM "spaces" s WHERE s."id" = NULLIF(current_setting('app.space_id', true), ''))
  );
ALTER TABLE "model_credit_lots" ENABLE ROW LEVEL SECURITY;
CREATE POLICY model_credit_lots_org ON "model_credit_lots"
  USING (
    NULLIF(current_setting('app.space_id', true), '') IS NULL
    OR current_setting('app.rls_bypass', true) = 'on'
    OR "organizationId" = (SELECT s."organizationId" FROM "spaces" s WHERE s."id" = NULLIF(current_setting('app.space_id', true), ''))
  );
ALTER TABLE "model_credit_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY model_credit_entries_org ON "model_credit_entries"
  USING (
    NULLIF(current_setting('app.space_id', true), '') IS NULL
    OR current_setting('app.rls_bypass', true) = 'on'
    OR "organizationId" = (SELECT s."organizationId" FROM "spaces" s WHERE s."id" = NULLIF(current_setting('app.space_id', true), ''))
  );
