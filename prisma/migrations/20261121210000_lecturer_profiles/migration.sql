CREATE TABLE "LecturerProfile" (
  "personId" TEXT NOT NULL,
  "avatar" TEXT NOT NULL,
  "position" TEXT NOT NULL,
  "phoneExtension" TEXT NOT NULL,
  "office" TEXT NOT NULL,
  "since" INTEGER NOT NULL,
  "biography" TEXT NOT NULL,
  "education" TEXT[],
  "languages" TEXT[],
  "interests" TEXT[],
  "topics" TEXT NOT NULL,

  CONSTRAINT "LecturerProfile_pkey" PRIMARY KEY ("personId"),
  CONSTRAINT "LecturerProfile_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
