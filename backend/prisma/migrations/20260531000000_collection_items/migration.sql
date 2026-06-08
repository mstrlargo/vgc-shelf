CREATE TYPE "CollectionItemCategory" AS ENUM ('SYSTEM', 'PERIPHERAL', 'TOYS_TO_LIFE', 'OTHER');

CREATE TABLE "CollectionItem" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "category" "CollectionItemCategory" NOT NULL,
  "name" TEXT NOT NULL,
  "maker" TEXT,
  "platform" TEXT,
  "modelNumber" TEXT,
  "serialNumber" TEXT,
  "barcode" TEXT,
  "condition" "ConditionGrade" NOT NULL DEFAULT 'GOOD',
  "estimatedValue" DECIMAL(10,2),
  "imageUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");
CREATE INDEX "CollectionItem_barcode_idx" ON "CollectionItem"("barcode");

ALTER TABLE "CollectionItem"
ADD CONSTRAINT "CollectionItem_collectionId_fkey"
FOREIGN KEY ("collectionId") REFERENCES "Collection"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
