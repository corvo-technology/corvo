-- Additive: the previous release neither reads nor writes this table.
CREATE TABLE "provider_quotas" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "windows" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_quotas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_quotas_spaceId_userId_provider_key" ON "provider_quotas"("spaceId", "userId", "provider");

ALTER TABLE "provider_quotas" ADD CONSTRAINT "provider_quotas_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same policies as model_oauth_sessions.
ALTER TABLE "provider_quotas" ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_quotas_tenant ON "provider_quotas"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY provider_quotas_system ON "provider_quotas"
  USING (current_setting('app.rls_bypass', true) = 'on');
