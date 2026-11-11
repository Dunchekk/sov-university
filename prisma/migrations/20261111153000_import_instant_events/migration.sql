-- RFC 5545 timed VEVENT without DTEND/DURATION has zero duration. Date-only
-- events retain their strictly exclusive, later end date.
ALTER TABLE "ImportedEvent" DROP CONSTRAINT "ImportedEvent_time_shape";
ALTER TABLE "ImportedEvent" ADD CONSTRAINT "ImportedEvent_time_shape" CHECK ((("startsAt" IS NOT NULL AND "endsAt" >= "startsAt" AND "startDate" IS NULL AND "endDate" IS NULL) OR ("startsAt" IS NULL AND "endsAt" IS NULL AND "startDate" IS NOT NULL AND "endDate" > "startDate")) IS TRUE);
