-- CreateTable
CREATE TABLE "AchievementHistory" (
    "id" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievementHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AchievementHistory_achievementId_createdAt_idx" ON "AchievementHistory"("achievementId", "createdAt");

-- AddForeignKey
ALTER TABLE "AchievementHistory" ADD CONSTRAINT "AchievementHistory_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
