-- Additive: the previous release neither reads nor writes these tables or columns.
-- AlterTable
ALTER TABLE "threads" ADD COLUMN     "wikiCapture" BOOLEAN,
ADD COLUMN     "wikiCuratedUpToSeq" INTEGER;

-- CreateTable
CREATE TABLE "wiki_settings" (
    "spaceId" TEXT NOT NULL,
    "capture" BOOLEAN NOT NULL DEFAULT true,
    "edits" TEXT NOT NULL DEFAULT 'approve',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wiki_settings_pkey" PRIMARY KEY ("spaceId")
);

-- CreateTable
CREATE TABLE "wiki_sources" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "threadId" TEXT,
    "origin" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "fromSeq" INTEGER,
    "toSeq" INTEGER,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wiki_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wiki_changes" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "ops" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "baseRevisions" JSONB NOT NULL,
    "appliedRevisions" JSONB,
    "anchorThreadId" TEXT,
    "anchorMessageId" TEXT,
    "decidedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "wiki_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wiki_sources_spaceId_idx" ON "wiki_sources"("spaceId");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_sources_threadId_fromSeq_toSeq_key" ON "wiki_sources"("threadId", "fromSeq", "toSeq");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_sources_threadId_messageId_key" ON "wiki_sources"("threadId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "wiki_changes_sourceId_key" ON "wiki_changes"("sourceId");

-- CreateIndex
CREATE INDEX "wiki_changes_spaceId_state_idx" ON "wiki_changes"("spaceId", "state");

-- AddForeignKey
ALTER TABLE "wiki_settings" ADD CONSTRAINT "wiki_settings_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_sources" ADD CONSTRAINT "wiki_sources_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_sources" ADD CONSTRAINT "wiki_sources_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_changes" ADD CONSTRAINT "wiki_changes_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wiki_changes" ADD CONSTRAINT "wiki_changes_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "wiki_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Same policies as provider_quotas: any member of the Space reaches its wiki rows.
ALTER TABLE "wiki_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY wiki_settings_tenant ON "wiki_settings"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY wiki_settings_system ON "wiki_settings"
  USING (current_setting('app.rls_bypass', true) = 'on');

ALTER TABLE "wiki_sources" ENABLE ROW LEVEL SECURITY;
CREATE POLICY wiki_sources_tenant ON "wiki_sources"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY wiki_sources_system ON "wiki_sources"
  USING (current_setting('app.rls_bypass', true) = 'on');

ALTER TABLE "wiki_changes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY wiki_changes_tenant ON "wiki_changes"
  USING ("spaceId" = NULLIF(current_setting('app.space_id', true), ''));
CREATE POLICY wiki_changes_system ON "wiki_changes"
  USING (current_setting('app.rls_bypass', true) = 'on');
