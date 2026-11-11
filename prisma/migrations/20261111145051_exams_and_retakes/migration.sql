-- CreateTable
CREATE TABLE "Retake" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "consultation" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Retake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Retake_enrollmentId_startsAt_idx" ON "Retake"("enrollmentId", "startsAt");

-- AddForeignKey
ALTER TABLE "Retake" ADD CONSTRAINT "Retake_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
