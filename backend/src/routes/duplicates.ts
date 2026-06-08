import { Router } from "express";
import { z } from "zod";
import { CollectionRole } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAuth, requireCollectionRole } from "../auth.js";
import { compactTitleKey, normalizeBarcode, normalizeFormat, normalizeText } from "../lib/normalization.js";

const router = Router();
router.use(requireAuth);

type DuplicateCandidate = {
  id: string;
  type: "GAME_COPY" | "COLLECTION_ITEM";
  title: string;
  platform?: string | null;
  barcode?: string | null;
  format?: string | null;
  reason: string;
  assetTag?: { tag: string } | null;
};

function addGroup(groups: Map<string, DuplicateCandidate[]>, key: string, item: DuplicateCandidate) {
  if (!key) return;
  const existing = groups.get(key) || [];
  existing.push(item);
  groups.set(key, existing);
}

async function collectionDuplicates(collectionId: string) {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: {
      copies: {
        include: {
          game: { include: { platform: true } },
          assetTag: { select: { tag: true } }
        }
      },
      items: {
        include: {
          assetTag: { select: { tag: true } }
        }
      }
    }
  });

  if (!collection) return null;

  const groups = new Map<string, DuplicateCandidate[]>();

  for (const copy of collection.copies) {
    const titleKey = compactTitleKey(copy.game.title);
    const platformKey = normalizeText(copy.game.platform?.name);
    const barcodeKey = normalizeBarcode(copy.barcode);
    const formatKey = normalizeFormat(copy.format);
    const candidate: DuplicateCandidate = {
      id: copy.id,
      type: "GAME_COPY",
      title: copy.game.title,
      platform: copy.game.platform?.name || null,
      barcode: copy.barcode,
      format: copy.format,
      reason: "",
      assetTag: copy.assetTag
    };

    addGroup(groups, `game:${titleKey}:${platformKey}:${formatKey}`, { ...candidate, reason: "Same title, platform, and format" });
    addGroup(groups, `game-title-platform:${titleKey}:${platformKey}`, { ...candidate, reason: "Same title and platform" });
    addGroup(groups, barcodeKey ? `barcode:${barcodeKey}` : "", { ...candidate, reason: "Same barcode" });
  }

  for (const item of collection.items) {
    const nameKey = compactTitleKey(item.name);
    const platformKey = normalizeText(item.platform);
    const barcodeKey = normalizeBarcode(item.barcode);
    const modelKey = normalizeText(item.modelNumber || item.serialNumber);
    const candidate: DuplicateCandidate = {
      id: item.id,
      type: "COLLECTION_ITEM",
      title: item.name,
      platform: item.platform,
      barcode: item.barcode,
      format: item.category,
      reason: "",
      assetTag: item.assetTag
    };

    addGroup(groups, `item:${nameKey}:${platformKey}`, { ...candidate, reason: "Same name and platform" });
    addGroup(groups, barcodeKey ? `barcode:${barcodeKey}` : "", { ...candidate, reason: "Same barcode" });
    addGroup(groups, modelKey ? `model:${modelKey}` : "", { ...candidate, reason: "Same model or serial number" });
  }

  const seen = new Set<string>();
  const duplicates = Array.from(groups.entries())
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => {
      const uniqueItems = items.filter((item, index, array) => array.findIndex((other) => other.id === item.id && other.type === item.type) === index);
      const signature = uniqueItems.map((item) => `${item.type}:${item.id}`).sort().join("|");
      if (seen.has(signature) || uniqueItems.length < 2) return null;
      seen.add(signature);
      return { key, reason: uniqueItems[0].reason, items: uniqueItems };
    })
    .filter(Boolean);

  return duplicates;
}

router.get("/collections/:collectionId/duplicates", async (req, res, next) => {
  try {
    const membership = await requireCollectionRole(req.params.collectionId, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR,
      CollectionRole.VIEWER
    ]);

    if (!membership) return res.status(403).json({ error: "No access to collection" });

    const duplicates = await collectionDuplicates(req.params.collectionId);
    if (!duplicates) return res.status(404).json({ error: "Collection not found" });

    res.json({ duplicates });
  } catch (err) {
    next(err);
  }
});

const checkSchema = z.object({
  title: z.string().optional().nullable(),
  platformName: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  format: z.string().optional().nullable(),
  itemName: z.string().optional().nullable(),
  modelNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable()
});

router.post("/collections/:collectionId/duplicates/check", async (req, res, next) => {
  try {
    const membership = await requireCollectionRole(req.params.collectionId, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR,
      CollectionRole.VIEWER
    ]);

    if (!membership) return res.status(403).json({ error: "No access to collection" });

    const body = checkSchema.parse(req.body);
    const collection = await prisma.collection.findUnique({
      where: { id: req.params.collectionId },
      include: {
        copies: { include: { game: { include: { platform: true } }, assetTag: { select: { tag: true } } } },
        items: { include: { assetTag: { select: { tag: true } } } }
      }
    });

    if (!collection) return res.status(404).json({ error: "Collection not found" });

    const barcodeKey = normalizeBarcode(body.barcode);
    const titleKey = compactTitleKey(body.title || body.itemName);
    const platformKey = normalizeText(body.platformName);
    const formatKey = normalizeFormat(body.format || undefined);
    const modelKey = normalizeText(body.modelNumber || body.serialNumber);

    const matches: DuplicateCandidate[] = [];

    for (const copy of collection.copies) {
      const copyBarcode = normalizeBarcode(copy.barcode);
      const copyTitle = compactTitleKey(copy.game.title);
      const copyPlatform = normalizeText(copy.game.platform?.name);
      const byBarcode = barcodeKey && copyBarcode === barcodeKey;
      const byTitle = titleKey && copyTitle === titleKey && (!platformKey || copyPlatform === platformKey) && normalizeFormat(copy.format) === formatKey;

      if (byBarcode || byTitle) {
        matches.push({
          id: copy.id,
          type: "GAME_COPY",
          title: copy.game.title,
          platform: copy.game.platform?.name || null,
          barcode: copy.barcode,
          format: copy.format,
          reason: byBarcode ? "Same barcode" : "Same title, platform, and format",
          assetTag: copy.assetTag
        });
      }
    }

    for (const item of collection.items) {
      const itemBarcode = normalizeBarcode(item.barcode);
      const itemNameKey = compactTitleKey(item.name);
      const itemPlatformKey = normalizeText(item.platform);
      const itemModelKey = normalizeText(item.modelNumber || item.serialNumber);
      const byBarcode = barcodeKey && itemBarcode === barcodeKey;
      const byName = titleKey && itemNameKey === titleKey && (!platformKey || itemPlatformKey === platformKey);
      const byModel = modelKey && itemModelKey === modelKey;

      if (byBarcode || byName || byModel) {
        matches.push({
          id: item.id,
          type: "COLLECTION_ITEM",
          title: item.name,
          platform: item.platform,
          barcode: item.barcode,
          format: item.category,
          reason: byBarcode ? "Same barcode" : byModel ? "Same model or serial number" : "Same name and platform",
          assetTag: item.assetTag
        });
      }
    }

    res.json({ matches });
  } catch (err) {
    next(err);
  }
});

export default router;
