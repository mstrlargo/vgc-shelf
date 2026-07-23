ALTER TABLE "CollectionItem" ADD COLUMN IF NOT EXISTS "releaseYear" INTEGER;
ALTER TABLE "CollectionItem" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "CollectionItem" ADD COLUMN IF NOT EXISTS "priceChartingProductId" TEXT;
ALTER TABLE "CollectionItem" ADD COLUMN IF NOT EXISTS "priceChartingProductName" TEXT;
ALTER TABLE "CollectionItem" ADD COLUMN IF NOT EXISTS "priceChartingConsoleName" TEXT;

CREATE TABLE IF NOT EXISTS "CollectionItemPart" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "type" "GamePartType" NOT NULL,
  "condition" "ConditionGrade" NOT NULL DEFAULT 'GOOD',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CollectionItemPart_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CollectionItemPart_itemId_idx" ON "CollectionItemPart"("itemId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CollectionItemPart_itemId_fkey'
  ) THEN
    ALTER TABLE "CollectionItemPart"
      ADD CONSTRAINT "CollectionItemPart_itemId_fkey"
      FOREIGN KEY ("itemId") REFERENCES "CollectionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
