-- AlterTable
ALTER TABLE "partners" ADD COLUMN "ownerUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "partners_ownerUserId_key" ON "partners"("ownerUserId");

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
