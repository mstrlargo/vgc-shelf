import { Router } from "express";
import { z } from "zod";
import { CollectionRole, ConditionGrade, GameCopyFormat, GamePartType } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAuth, requireCollectionRole } from "../auth.js";

const router = Router();

const partSchema = z.object({
  type: z.nativeEnum(GamePartType),
  condition: z.nativeEnum(ConditionGrade).default(ConditionGrade.GOOD),
  notes: z.string().optional().nullable()
});

const copySchema = z.object({
  gameId: z.string(),
  format: z.nativeEnum(GameCopyFormat).default(GameCopyFormat.PHYSICAL),
  barcode: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  edition: z.string().optional().nullable(),
  purchaseDate: z.string().datetime().optional().nullable(),
  purchasePrice: z.number().nonnegative().optional().nullable(),
  estimatedValue: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
  parts: z.array(partSchema).optional()
});

const updateCopySchema = z.object({
  format: z.nativeEnum(GameCopyFormat).optional(),
  barcode: z.string().optional().nullable(),
  region: z.string().optional().nullable(),
  edition: z.string().optional().nullable(),
  purchaseDate: z.string().datetime().optional().nullable(),
  purchasePrice: z.number().nonnegative().optional().nullable(),
  estimatedValue: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
  parts: z.array(partSchema).optional(),
  game: z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    releaseYear: z.number().int().min(1950).max(2100).optional().nullable(),
    coverUrl: z.string().url().optional().nullable(),
    platformId: z.string().optional().nullable(),
    platformName: z.string().optional().nullable()
  }).optional()
});

function cleanString(value: string | null | undefined) {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeParts(parts: Array<z.infer<typeof partSchema>> | undefined) {
  if (!parts) return undefined;

  return parts.map((part) => ({
    type: part.type,
    condition: part.condition,
    notes: cleanString(part.notes)
  }));
}

router.get("/collections/:collectionId/copies", requireAuth, async (req, res, next) => {
  try {
    const membership = await requireCollectionRole(req.params.collectionId, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR,
      CollectionRole.VIEWER
    ]);

    if (!membership) return res.status(403).json({ error: "No access to collection" });

    const copies = await prisma.gameCopy.findMany({
      where: { collectionId: req.params.collectionId },
      include: {
        game: { include: { platform: true } },
        parts: true
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ copies });
  } catch (err) {
    next(err);
  }
});

router.post("/collections/:collectionId/copies", requireAuth, async (req, res, next) => {
  try {
    const membership = await requireCollectionRole(req.params.collectionId, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR
    ]);

    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    const body = copySchema.parse(req.body);
    const parts = normalizeParts(body.parts);

    const copy = await prisma.gameCopy.create({
      data: {
        collectionId: req.params.collectionId,
        gameId: body.gameId,
        format: body.format,
        barcode: cleanString(body.barcode),
        region: cleanString(body.region),
        edition: cleanString(body.edition),
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
        purchasePrice: body.purchasePrice ?? undefined,
        estimatedValue: body.estimatedValue ?? undefined,
        notes: cleanString(body.notes),
        parts: parts ? { create: parts } : undefined
      },
      include: {
        game: { include: { platform: true } },
        parts: true
      }
    });

    res.status(201).json({ copy });
  } catch (err) {
    next(err);
  }
});

router.get("/copies/:id", requireAuth, async (req, res, next) => {
  try {
    const copy = await prisma.gameCopy.findUnique({
      where: { id: req.params.id },
      include: {
        collection: true,
        game: { include: { platform: true } },
        parts: true
      }
    });

    if (!copy) return res.status(404).json({ error: "Copy not found" });

    const membership = await requireCollectionRole(copy.collectionId, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR,
      CollectionRole.VIEWER
    ]);

    if (!membership) return res.status(403).json({ error: "No access to copy" });

    res.json({ copy });
  } catch (err) {
    next(err);
  }
});

router.patch("/copies/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.gameCopy.findUnique({
      where: { id: req.params.id },
      include: { game: true }
    });

    if (!existing) return res.status(404).json({ error: "Copy not found" });

    const membership = await requireCollectionRole(existing.collectionId, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR
    ]);

    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    const body = updateCopySchema.parse(req.body);

    let platformId = body.game?.platformId ?? undefined;

    if (body.game?.platformName) {
      const platform = await prisma.platform.upsert({
        where: { name: body.game.platformName },
        update: {},
        create: { name: body.game.platformName }
      });

      platformId = platform.id;
    }

    const parts = normalizeParts(body.parts);

    const updated = await prisma.$transaction(async (tx) => {
      if (body.game) {
        await tx.game.update({
          where: { id: existing.gameId },
          data: {
            title: body.game.title,
            description: typeof body.game.description === "undefined" ? undefined : cleanString(body.game.description),
            releaseYear: typeof body.game.releaseYear === "undefined" ? undefined : body.game.releaseYear,
            coverUrl: typeof body.game.coverUrl === "undefined" ? undefined : cleanString(body.game.coverUrl),
            platformId
          }
        });
      }

      if (parts) {
        await tx.gamePart.deleteMany({ where: { copyId: req.params.id } });

        if (parts.length > 0) {
          await tx.gamePart.createMany({
            data: parts.map((part) => ({
              copyId: req.params.id,
              type: part.type,
              condition: part.condition,
              notes: part.notes
            }))
          });
        }
      }

      return tx.gameCopy.update({
        where: { id: req.params.id },
        data: {
          format: body.format,
          barcode: typeof body.barcode === "undefined" ? undefined : cleanString(body.barcode),
          region: typeof body.region === "undefined" ? undefined : cleanString(body.region),
          edition: typeof body.edition === "undefined" ? undefined : cleanString(body.edition),
          purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : undefined,
          purchasePrice: typeof body.purchasePrice === "undefined" ? undefined : body.purchasePrice,
          estimatedValue: typeof body.estimatedValue === "undefined" ? undefined : body.estimatedValue,
          notes: typeof body.notes === "undefined" ? undefined : cleanString(body.notes)
        },
        include: {
          game: { include: { platform: true } },
          parts: true
        }
      });
    });

    res.json({ copy: updated });
  } catch (err) {
    next(err);
  }
});

router.delete("/copies/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.gameCopy.findUnique({ where: { id: req.params.id } });

    if (!existing) return res.status(404).json({ error: "Copy not found" });

    const membership = await requireCollectionRole(existing.collectionId, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR
    ]);

    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    await prisma.gameCopy.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/copies/:id/parts", requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.gameCopy.findUnique({ where: { id: req.params.id } });

    if (!existing) return res.status(404).json({ error: "Copy not found" });

    const membership = await requireCollectionRole(existing.collectionId, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR
    ]);

    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    const body = partSchema.parse(req.body);

    const part = await prisma.gamePart.create({
      data: {
        copyId: req.params.id,
        type: body.type,
        condition: body.condition,
        notes: cleanString(body.notes)
      }
    });

    res.status(201).json({ part });
  } catch (err) {
    next(err);
  }
});

router.delete("/parts/:id", requireAuth, async (req, res, next) => {
  try {
    const part = await prisma.gamePart.findUnique({
      where: { id: req.params.id },
      include: { copy: true }
    });

    if (!part) return res.status(404).json({ error: "Part not found" });

    const membership = await requireCollectionRole(part.copy.collectionId, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR
    ]);

    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    await prisma.gamePart.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
