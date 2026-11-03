-- Additive: the previous release neither reads nor writes this column.
ALTER TABLE "bots" ADD COLUMN "dailyCapMicros" BIGINT;
