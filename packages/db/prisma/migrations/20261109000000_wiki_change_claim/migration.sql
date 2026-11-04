-- Additive: the previous release neither reads nor writes this column.
-- AlterTable
ALTER TABLE "wiki_changes" ADD COLUMN     "claimedAt" TIMESTAMP(3);
