-- Additive: the previous release neither reads nor writes this table.
-- CreateTable
CREATE TABLE "artifact_transcripts" (
    "artifactId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "language" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "artifact_transcripts_pkey" PRIMARY KEY ("artifactId")
);

-- CreateIndex
CREATE INDEX "artifact_transcripts_spaceId_idx" ON "artifact_transcripts"("spaceId");

-- AddForeignKey
ALTER TABLE "artifact_transcripts" ADD CONSTRAINT "artifact_transcripts_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_transcripts" ADD CONSTRAINT "artifact_transcripts_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Same policies as wiki_sources: any member of the Space reaches its rows.
ALTER TABLE "artifact_transcripts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY artifact_transcripts_tenant ON "artifact_transcripts"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY artifact_transcripts_system ON "artifact_transcripts"
  USING (current_setting('app.rls_bypass', true) = 'on');
