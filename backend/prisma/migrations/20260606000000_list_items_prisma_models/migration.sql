CREATE TABLE IF NOT EXISTS "WishlistItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "platform" TEXT,
  "category" TEXT NOT NULL DEFAULT 'GAME',
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "targetPrice" DECIMAL(10,2),
  "notes" TEXT,
  "imageUrl" TEXT,
  "barcode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SellListItem" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
  "sourceId" TEXT,
  "title" TEXT NOT NULL,
  "platform" TEXT,
  "category" TEXT NOT NULL DEFAULT 'GAME',
  "askingPrice" DECIMAL(10,2),
  "currentValue" DECIMAL(10,2),
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "notes" TEXT,
  "imageUrl" TEXT,
  "assetTag" TEXT,
  "collectionName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellListItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WishlistItem_userId_idx" ON "WishlistItem"("userId");
CREATE INDEX IF NOT EXISTS "WishlistItem_barcode_idx" ON "WishlistItem"("barcode");
CREATE INDEX IF NOT EXISTS "SellListItem_userId_idx" ON "SellListItem"("userId");
CREATE INDEX IF NOT EXISTS "SellListItem_sourceId_idx" ON "SellListItem"("sourceId");

DO $$ BEGIN
  ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "SellListItem" ADD CONSTRAINT "SellListItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
