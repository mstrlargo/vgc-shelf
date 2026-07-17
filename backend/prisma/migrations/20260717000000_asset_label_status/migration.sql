CREATE TYPE "AssetLabelStatus" AS ENUM ('NORMAL', 'MISSING', 'DAMAGED');

ALTER TABLE "AssetTag"
ADD COLUMN "labelStatus" "AssetLabelStatus" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "labelLastPrintedAt" TIMESTAMP(3);

CREATE INDEX "AssetTag_labelStatus_idx" ON "AssetTag"("labelStatus");
