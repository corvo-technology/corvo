-- Columns only: the previous release keeps running beside this one for a few seconds.
ALTER TABLE "boards" ADD COLUMN "statusLabels" JSONB;
ALTER TABLE "tickets" ADD COLUMN "fields" JSONB;
