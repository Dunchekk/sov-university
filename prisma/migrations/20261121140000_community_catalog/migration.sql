ALTER TABLE "CommunityEvent"
ADD COLUMN "city" TEXT NOT NULL DEFAULT 'Москва',
ADD COLUMN "cover" TEXT;

ALTER TABLE "NewsPost"
ADD COLUMN "city" TEXT NOT NULL DEFAULT 'Москва',
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Университет',
ADD COLUMN "cover" TEXT;
