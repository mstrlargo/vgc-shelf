CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

CREATE TABLE "AppSetting" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "allowPublicSignup" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AppSetting" ("id", "allowPublicSignup", "updatedAt")
VALUES ('global', true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

UPDATE "User"
SET "role" = 'ADMIN'
WHERE "email" = 'owner@example.com';
