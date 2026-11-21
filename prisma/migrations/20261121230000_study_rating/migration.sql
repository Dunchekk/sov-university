CREATE TABLE "RatingCohort" (
  "programId" TEXT NOT NULL,
  "academicYear" INTEGER NOT NULL,
  "studyYear" INTEGER NOT NULL,
  "referenceCredits" INTEGER NOT NULL CHECK ("referenceCredits" > 0),
  "scores" INTEGER[],
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "demo" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "RatingCohort_pkey" PRIMARY KEY ("programId", "academicYear", "studyYear"),
  CONSTRAINT "RatingCohort_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
