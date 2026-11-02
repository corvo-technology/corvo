-- CreateTable
CREATE TABLE "routine_steps" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "instruction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routine_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "routine_steps_routineId_position_key" ON "routine_steps"("routineId", "position");

-- CreateIndex
CREATE INDEX "routine_steps_botId_idx" ON "routine_steps"("botId");

-- AddForeignKey
ALTER TABLE "routine_steps" ADD CONSTRAINT "routine_steps_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_steps" ADD CONSTRAINT "routine_steps_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "runs" ADD COLUMN "routineStepId" TEXT,
ADD COLUMN "stepOfRunId" TEXT;
