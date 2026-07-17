ALTER TABLE "Collection"
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "archivedAt" TIMESTAMP(3);

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) - 1 AS position
  FROM "Collection"
)
UPDATE "Collection" AS collection
SET "sortOrder" = ordered.position
FROM ordered
WHERE collection.id = ordered.id;

CREATE INDEX "Collection_isArchived_sortOrder_idx"
ON "Collection"("isArchived", "sortOrder");
