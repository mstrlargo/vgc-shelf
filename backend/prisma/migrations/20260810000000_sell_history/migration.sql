ALTER TABLE "SellListItem"
ADD COLUMN IF NOT EXISTS "soldPrice" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "soldAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "sourceRemovedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "SellListItem_status_soldAt_idx" ON "SellListItem"("status", "soldAt");
