DO $$ BEGIN
  CREATE TYPE "LoanStatus" AS ENUM ('CHECKED_OUT', 'RETURNED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "AssetTag" (
  "id" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "gameCopyId" TEXT,
  "collectionItemId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssetTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AssetTag_tag_key" ON "AssetTag"("tag");
CREATE UNIQUE INDEX IF NOT EXISTS "AssetTag_gameCopyId_key" ON "AssetTag"("gameCopyId");
CREATE UNIQUE INDEX IF NOT EXISTS "AssetTag_collectionItemId_key" ON "AssetTag"("collectionItemId");

ALTER TABLE "AssetTag"
ADD CONSTRAINT "AssetTag_gameCopyId_fkey"
FOREIGN KEY ("gameCopyId") REFERENCES "GameCopy"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AssetTag"
ADD CONSTRAINT "AssetTag_collectionItemId_fkey"
FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Loan" (
  "id" TEXT NOT NULL,
  "assetTagId" TEXT NOT NULL,
  "checkedOutByUserId" TEXT NOT NULL,
  "borrowerName" TEXT NOT NULL,
  "borrowerEmail" TEXT,
  "checkedOutAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "status" "LoanStatus" NOT NULL DEFAULT 'CHECKED_OUT',
  "checkoutNotes" TEXT,
  "returnNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Loan_assetTagId_idx" ON "Loan"("assetTagId");
CREATE INDEX IF NOT EXISTS "Loan_status_idx" ON "Loan"("status");

ALTER TABLE "Loan"
ADD CONSTRAINT "Loan_assetTagId_fkey"
FOREIGN KEY ("assetTagId") REFERENCES "AssetTag"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Loan"
ADD CONSTRAINT "Loan_checkedOutByUserId_fkey"
FOREIGN KEY ("checkedOutByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
