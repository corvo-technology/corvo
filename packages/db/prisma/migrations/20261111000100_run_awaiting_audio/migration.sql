-- Additive: the previous release neither reads nor writes this column.
-- AlterTable
ALTER TABLE "runs" ADD COLUMN     "awaitingAudioAt" TIMESTAMP(3);
