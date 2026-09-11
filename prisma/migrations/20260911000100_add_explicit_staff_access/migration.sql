ALTER TABLE "StaffProfile"
ADD COLUMN "allowedAppIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "accessConfigured" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Application"
SET "visibleToAllStaff" = ("slug" = 'via-agent');

UPDATE "StaffProfile" AS staff
SET
  "allowedAppIds" = ARRAY(
    SELECT app."id"
    FROM "Application" AS app
    WHERE app."status" = 'active'
      AND app."visibleToAllStaff" = false
      AND LOWER(staff."email") = ANY(
        SELECT LOWER(listed.email)
        FROM UNNEST(app."visibleToEmails") AS listed(email)
      )
  ),
  "accessConfigured" = true;
