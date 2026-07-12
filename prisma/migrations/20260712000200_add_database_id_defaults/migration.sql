CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "Application" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "UserAppAccess" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
