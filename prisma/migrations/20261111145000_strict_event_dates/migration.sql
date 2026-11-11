ALTER TABLE "PersonalEvent" DROP CONSTRAINT "PersonalEvent_time_shape";
ALTER TABLE "PersonalEvent" ADD CONSTRAINT "PersonalEvent_time_shape" CHECK ((("startsAt" IS NOT NULL AND "endsAt" > "startsAt" AND "startDate" IS NULL AND "endDate" IS NULL) OR ("startsAt" IS NULL AND "endsAt" IS NULL AND "startDate" IS NOT NULL AND "endDate" > "startDate")) IS TRUE);
ALTER TABLE "ImportedEvent" DROP CONSTRAINT "ImportedEvent_time_shape";
ALTER TABLE "ImportedEvent" ADD CONSTRAINT "ImportedEvent_time_shape" CHECK ((("startsAt" IS NOT NULL AND "endsAt" > "startsAt" AND "startDate" IS NULL AND "endDate" IS NULL) OR ("startsAt" IS NULL AND "endsAt" IS NULL AND "startDate" IS NOT NULL AND "endDate" > "startDate")) IS TRUE);
