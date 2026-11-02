-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_tenants" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "externalTenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'enabled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_entry_codes" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "externalEmail" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_entry_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partners_slug_key" ON "partners"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "partners_keyPrefix_key" ON "partners"("keyPrefix");

-- CreateIndex
CREATE UNIQUE INDEX "partner_tenants_organizationId_key" ON "partner_tenants"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_tenants_partnerId_externalTenantId_key" ON "partner_tenants"("partnerId", "externalTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_entry_codes_codeHash_key" ON "partner_entry_codes"("codeHash");

-- CreateIndex
CREATE INDEX "partner_entry_codes_expiresAt_idx" ON "partner_entry_codes"("expiresAt");

-- AddForeignKey
ALTER TABLE "partner_tenants" ADD CONSTRAINT "partner_tenants_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_tenants" ADD CONSTRAINT "partner_tenants_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_tenants" ADD CONSTRAINT "partner_tenants_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_entry_codes" ADD CONSTRAINT "partner_entry_codes_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_entry_codes" ADD CONSTRAINT "partner_entry_codes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "partner_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partner data is internal: only server code that runs as the system reads or writes it, never a
-- request in a customer's context. The migration role owns the tables and keeps access.
ALTER TABLE "partners" ENABLE ROW LEVEL SECURITY;
CREATE POLICY partners_system ON "partners"
  USING (current_setting('app.rls_bypass', true) = 'on');

ALTER TABLE "partner_tenants" ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_tenants_system ON "partner_tenants"
  USING (current_setting('app.rls_bypass', true) = 'on');

ALTER TABLE "partner_entry_codes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_entry_codes_system ON "partner_entry_codes"
  USING (current_setting('app.rls_bypass', true) = 'on');
