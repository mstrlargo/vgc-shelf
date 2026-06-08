ALTER TABLE "GameCopy" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
CREATE INDEX IF NOT EXISTS "GameCopy_barcode_idx" ON "GameCopy"("barcode");
