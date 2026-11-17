ALTER TABLE "Application"
ALTER COLUMN "visibleToAllStaff" SET DEFAULT false;

UPDATE "Application"
SET "visibleToAllStaff" = false
WHERE "visibleToAllStaff" = true;
