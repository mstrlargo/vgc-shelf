ALTER TABLE "AppSetting"
ADD COLUMN "assetLabelShowQr" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "assetLabelShowLabelText" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "assetLabelShowAssetTag" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "assetLabelShowItemTitle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "assetLabelShowCollectionName" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "assetLabelShowPlatform" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "assetLabelShowCollectionType" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "assetLabelShowOwnerName" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "assetLabelShowOwnerEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "assetLabelShowBarcode" BOOLEAN NOT NULL DEFAULT false;
