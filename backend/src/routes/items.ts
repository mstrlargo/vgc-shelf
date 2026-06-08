import { Router } from "express";
import { z } from "zod";
import { CollectionItemCategory, CollectionRole, CollectionType, ConditionGrade } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAuth, requireCollectionRole } from "../auth.js";

const router = Router();

router.use(requireAuth);

function cleanString(value: string | null | undefined) {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function categoryForCollectionType(type: CollectionType) {
  if (type === CollectionType.SYSTEMS) return CollectionItemCategory.SYSTEM;
  if (type === CollectionType.PERIPHERALS) return CollectionItemCategory.PERIPHERAL;
  if (type === CollectionType.TOYS_TO_LIFE) return CollectionItemCategory.TOYS_TO_LIFE;
  return null;
}

const itemSchema = z.object({
  name: z.string().min(1),
  maker: z.string().optional().nullable(),
  platform: z.string().optional().nullable(),
  modelNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  condition: z.nativeEnum(ConditionGrade).default(ConditionGrade.GOOD),
  purchasePrice: z.number().nonnegative().optional().nullable(),
  estimatedValue: z.number().nonnegative().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable()
});

const updateItemSchema = itemSchema.partial();

router.get("/collections/:collectionId/items", async (req, res, next) => {
  try {
    const membership = await requireCollectionRole(req.params.collectionId, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR,
      CollectionRole.VIEWER
    ]);

    if (!membership) return res.status(403).json({ error: "No access to collection" });

    const items = await prisma.collectionItem.findMany({
      where: { collectionId: req.params.collectionId },
      orderBy: { createdAt: "desc" }
    });

    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post("/collections/:collectionId/items", async (req, res, next) => {
  try {
    const membership = await requireCollectionRole(req.params.collectionId, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR
    ]);

    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    const collection = await prisma.collection.findUnique({
      where: { id: req.params.collectionId },
      select: { type: true }
    });

    if (!collection) return res.status(404).json({ error: "Collection not found" });

    const category = categoryForCollectionType(collection.type);

    if (!category) {
      return res.status(400).json({ error: "Inventory items can only be added to Systems, Peripherals, or Toys-to-life collections" });
    }

    const body = itemSchema.parse(req.body);

    const item = await prisma.collectionItem.create({
      data: {
        collectionId: req.params.collectionId,
        category,
        name: body.name,
        maker: cleanString(body.maker),
        platform: cleanString(body.platform),
        modelNumber: cleanString(body.modelNumber),
        serialNumber: cleanString(body.serialNumber),
        barcode: cleanString(body.barcode),
        condition: body.condition,
        purchasePrice: body.purchasePrice ?? undefined,
        estimatedValue: body.estimatedValue ?? undefined,
        imageUrl: cleanString(body.imageUrl),
        notes: cleanString(body.notes)
      }
    });

    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

router.patch("/items/:id", async (req, res, next) => {
  try {
    const existing = await prisma.collectionItem.findUnique({
      where: { id: req.params.id },
      include: { collection: { select: { type: true } } }
    });

    if (!existing) return res.status(404).json({ error: "Item not found" });

    const membership = await requireCollectionRole(existing.collectionId, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR
    ]);

    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    const category = categoryForCollectionType(existing.collection.type);

    if (!category) {
      return res.status(400).json({ error: "Inventory items can only exist in Systems, Peripherals, or Toys-to-life collections" });
    }

    const body = updateItemSchema.parse(req.body);

    const item = await prisma.collectionItem.update({
      where: { id: req.params.id },
      data: {
        category,
        name: body.name,
        maker: typeof body.maker === "undefined" ? undefined : cleanString(body.maker),
        platform: typeof body.platform === "undefined" ? undefined : cleanString(body.platform),
        modelNumber: typeof body.modelNumber === "undefined" ? undefined : cleanString(body.modelNumber),
        serialNumber: typeof body.serialNumber === "undefined" ? undefined : cleanString(body.serialNumber),
        barcode: typeof body.barcode === "undefined" ? undefined : cleanString(body.barcode),
        condition: body.condition,
        purchasePrice: typeof body.purchasePrice === "undefined" ? undefined : body.purchasePrice,
        estimatedValue: typeof body.estimatedValue === "undefined" ? undefined : body.estimatedValue,
        imageUrl: typeof body.imageUrl === "undefined" ? undefined : cleanString(body.imageUrl),
        notes: typeof body.notes === "undefined" ? undefined : cleanString(body.notes)
      }
    });

    res.json({ item });
  } catch (err) {
    next(err);
  }
});

router.delete("/items/:id", async (req, res, next) => {
  try {
    const existing = await prisma.collectionItem.findUnique({
      where: { id: req.params.id }
    });

    if (!existing) return res.status(404).json({ error: "Item not found" });

    const membership = await requireCollectionRole(existing.collectionId, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR
    ]);

    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    await prisma.collectionItem.delete({
      where: { id: req.params.id }
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
