-- A shared wiki is memory documents with the scope "wiki". Added only: the previous release keeps working.
ALTER TABLE "memory_documents" ADD COLUMN "slug" TEXT;
ALTER TABLE "memory_documents" ADD COLUMN "searchTokens" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
CREATE INDEX "memory_documents_searchTokens_idx" ON "memory_documents" USING GIN ("searchTokens");
-- One page per title in a space. Titles are compared by slug (no case, no accents).
CREATE UNIQUE INDEX "memory_documents_wiki_slug_key" ON "memory_documents"("spaceId", "slug") WHERE scope = 'wiki';
