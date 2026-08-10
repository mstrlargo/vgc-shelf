import { Router } from "express";
import { z } from "zod";
import { CollectionRole } from "@prisma/client";
import { prisma } from "../db.js";
import { ensureTables, id, now, sortSellList, toNumberOrNull, toStringOrNull, SellListRow } from "./listHelpers.js";

export function registerSellListRoutes(router: Router) {
  const sellListSchema = z.object({
    title: z.string().min(1).max(200),
    platform: z.string().nullable().optional(),
    category: z.enum(["GAME", "SYSTEM", "PERIPHERAL", "TOYS_TO_LIFE"]).default("GAME"),
    askingPrice: z.union([z.number(), z.string()]).nullable().optional(),
    currentValue: z.union([z.number(), z.string()]).nullable().optional(),
    status: z.enum(["AVAILABLE", "SOLD", "HOLD"]).default("AVAILABLE"),
    notes: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    assetTag: z.string().nullable().optional(),
    collectionName: z.string().nullable().optional(),
    soldPrice: z.union([z.number(), z.string()]).nullable().optional(),
    soldAt: z.coerce.date().nullable().optional()
  });

  const completeSaleSchema = z.object({
    soldPrice: z.union([z.number(), z.string()]).nullable().optional(),
    soldAt: z.coerce.date().optional(),
    notes: z.string().nullable().optional()
  });

  router.get("/sell-list", async (req, res, next) => {
    try {
      await ensureTables();

      const sort = String(req.query.sort || "newest");

      const rows = await prisma.$queryRawUnsafe<SellListRow[]>(
        'SELECT * FROM "SellListItem" WHERE "userId" = $1',
        req.user!.id
      );

      res.json({
        items: sortSellList(rows, sort)
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/sell-list", async (req, res, next) => {
    try {
      await ensureTables();

      const body = sellListSchema.parse(req.body);
      const itemId = id();
      const timestamp = now();

      await prisma.$executeRawUnsafe(
        `
        INSERT INTO "SellListItem"
        ("id", "userId", "sourceType", "sourceId", "title", "platform", "category", "askingPrice", "currentValue", "status", "notes", "imageUrl", "assetTag", "collectionName", "createdAt", "updatedAt")
        VALUES ($1,$2,'MANUAL',NULL,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        `,
        itemId,
        req.user!.id,
        body.title.trim(),
        toStringOrNull(body.platform),
        body.category,
        toNumberOrNull(body.askingPrice),
        toNumberOrNull(body.currentValue),
        body.status,
        toStringOrNull(body.notes),
        toStringOrNull(body.imageUrl),
        toStringOrNull(body.assetTag),
        toStringOrNull(body.collectionName),
        timestamp,
        timestamp
      );

      const rows = await prisma.$queryRawUnsafe<SellListRow[]>(
        'SELECT * FROM "SellListItem" WHERE "id" = $1 AND "userId" = $2 LIMIT 1',
        itemId,
        req.user!.id
      );

      res.status(201).json({ item: rows[0] });
    } catch (err) {
      next(err);
    }
  });

  router.post("/sell-list/from-game-copy/:id", async (req, res, next) => {
    try {
      await ensureTables();

      const body = z.object({
        askingPrice: z.union([z.string(), z.number()]).nullable().optional(),
        notes: z.string().nullable().optional()
      }).parse(req.body);

      const copy = await prisma.gameCopy.findFirst({
        where: {
          id: req.params.id,
          collection: {
            members: {
              some: {
                userId: req.user!.id
              }
            }
          }
        },
        include: {
          collection: true,
          game: {
            include: {
              platform: true
            }
          },
          assetTag: true
        }
      });

      if (!copy) return res.status(404).json({ error: "Game copy not found" });

      const itemId = id();
      const timestamp = now();

      await prisma.$executeRawUnsafe(
        `
        INSERT INTO "SellListItem"
        ("id", "userId", "sourceType", "sourceId", "title", "platform", "category", "askingPrice", "currentValue", "status", "notes", "imageUrl", "assetTag", "collectionName", "createdAt", "updatedAt")
        VALUES ($1,$2,'GAME_COPY',$3,$4,$5,'GAME',$6,$7,'AVAILABLE',$8,$9,$10,$11,$12,$13)
        `,
        itemId,
        req.user!.id,
        copy.id,
        copy.game.title,
        copy.game.platform?.name || null,
        toNumberOrNull(body.askingPrice),
        toNumberOrNull(copy.estimatedValue),
        toStringOrNull(body.notes) || copy.notes || null,
        copy.game.coverUrl || null,
        copy.assetTag?.tag || null,
        copy.collection.name,
        timestamp,
        timestamp
      );

      const rows = await prisma.$queryRawUnsafe<SellListRow[]>(
        'SELECT * FROM "SellListItem" WHERE "id" = $1 AND "userId" = $2 LIMIT 1',
        itemId,
        req.user!.id
      );

      res.status(201).json({ item: rows[0] });
    } catch (err) {
      next(err);
    }
  });

  router.post("/sell-list/from-collection-item/:id", async (req, res, next) => {
    try {
      await ensureTables();

      const body = z.object({
        askingPrice: z.union([z.string(), z.number()]).nullable().optional(),
        notes: z.string().nullable().optional()
      }).parse(req.body);

      const item = await prisma.collectionItem.findFirst({
        where: {
          id: req.params.id,
          collection: {
            members: {
              some: {
                userId: req.user!.id
              }
            }
          }
        },
        include: {
          collection: true,
          assetTag: true
        }
      });

      if (!item) return res.status(404).json({ error: "Collection item not found" });

      const itemId = id();
      const timestamp = now();

      await prisma.$executeRawUnsafe(
        `
        INSERT INTO "SellListItem"
        ("id", "userId", "sourceType", "sourceId", "title", "platform", "category", "askingPrice", "currentValue", "status", "notes", "imageUrl", "assetTag", "collectionName", "createdAt", "updatedAt")
        VALUES ($1,$2,'COLLECTION_ITEM',$3,$4,$5,$6,$7,$8,'AVAILABLE',$9,$10,$11,$12,$13,$14)
        `,
        itemId,
        req.user!.id,
        item.id,
        item.name,
        item.platform || null,
        item.category,
        toNumberOrNull(body.askingPrice),
        toNumberOrNull(item.estimatedValue),
        toStringOrNull(body.notes) || item.notes || null,
        item.imageUrl || null,
        item.assetTag?.tag || null,
        item.collection.name,
        timestamp,
        timestamp
      );

      const rows = await prisma.$queryRawUnsafe<SellListRow[]>(
        'SELECT * FROM "SellListItem" WHERE "id" = $1 AND "userId" = $2 LIMIT 1',
        itemId,
        req.user!.id
      );

      res.status(201).json({ item: rows[0] });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/sell-list/:id", async (req, res, next) => {
    try {
      await ensureTables();

      const body = sellListSchema.partial().parse(req.body);
      const existing = await prisma.$queryRawUnsafe<SellListRow[]>(
        'SELECT * FROM "SellListItem" WHERE "id" = $1 AND "userId" = $2 LIMIT 1',
        req.params.id,
        req.user!.id
      );

      if (!existing[0]) return res.status(404).json({ error: "Sell list item not found" });

      if (body.status === "SOLD" && existing[0].status !== "SOLD") {
        return res.status(400).json({ error: "Complete the sale to move this item into sold history" });
      }

      if (existing[0].status === "SOLD" && body.status && body.status !== "SOLD") {
        return res.status(400).json({ error: "Sold history entries cannot be returned to the active sell list" });
      }

      const nextItem = {
        ...existing[0],
        ...body
      };

      await prisma.$executeRawUnsafe(
        `
        UPDATE "SellListItem"
        SET "title" = $1,
            "platform" = $2,
            "category" = $3,
            "askingPrice" = $4,
            "currentValue" = $5,
            "status" = $6,
            "notes" = $7,
            "imageUrl" = $8,
            "assetTag" = $9,
            "collectionName" = $10,
            "soldPrice" = $11,
            "soldAt" = $12,
            "updatedAt" = $13
        WHERE "id" = $14 AND "userId" = $15
        `,
        String(nextItem.title).trim(),
        toStringOrNull(nextItem.platform),
        nextItem.category,
        toNumberOrNull(nextItem.askingPrice),
        toNumberOrNull(nextItem.currentValue),
        nextItem.status,
        toStringOrNull(nextItem.notes),
        toStringOrNull(nextItem.imageUrl),
        toStringOrNull(nextItem.assetTag),
        toStringOrNull(nextItem.collectionName),
        toNumberOrNull(nextItem.soldPrice),
        nextItem.soldAt || null,
        now(),
        req.params.id,
        req.user!.id
      );

      const rows = await prisma.$queryRawUnsafe<SellListRow[]>(
        'SELECT * FROM "SellListItem" WHERE "id" = $1 AND "userId" = $2 LIMIT 1',
        req.params.id,
        req.user!.id
      );

      res.json({ item: rows[0] });
    } catch (err) {
      next(err);
    }
  });

  router.post("/sell-list/:id/complete-sale", async (req, res, next) => {
    try {
      await ensureTables();

      const body = completeSaleSchema.parse(req.body);
      const existing = await prisma.$queryRawUnsafe<SellListRow[]>(
        'SELECT * FROM "SellListItem" WHERE "id" = $1 AND "userId" = $2 LIMIT 1',
        req.params.id,
        req.user!.id
      );
      const item = existing[0];

      if (!item) return res.status(404).json({ error: "Sell list item not found" });

      let sourceExists = false;

      if (item.sourceType === "GAME_COPY" && item.sourceId) {
        const copy = await prisma.gameCopy.findUnique({
          where: { id: item.sourceId },
          select: {
            collectionId: true,
            assetTag: {
              select: {
                loans: {
                  where: { status: "CHECKED_OUT" },
                  select: { id: true },
                  take: 1
                }
              }
            }
          }
        });

        if (copy) {
          if (copy.assetTag?.loans.length) {
            return res.status(409).json({ error: "Check this item in before completing its sale" });
          }

          sourceExists = true;
          const membership = await prisma.collectionMember.findUnique({
            where: { userId_collectionId: { userId: req.user!.id, collectionId: copy.collectionId } },
            select: { role: true }
          });

          if (!membership || (membership.role !== CollectionRole.OWNER && membership.role !== CollectionRole.EDITOR)) {
            return res.status(403).json({ error: "Editor or owner access is required to remove this item from its collection" });
          }
        }
      }

      if (item.sourceType === "COLLECTION_ITEM" && item.sourceId) {
        const collectionItem = await prisma.collectionItem.findUnique({
          where: { id: item.sourceId },
          select: {
            collectionId: true,
            assetTag: {
              select: {
                loans: {
                  where: { status: "CHECKED_OUT" },
                  select: { id: true },
                  take: 1
                }
              }
            }
          }
        });

        if (collectionItem) {
          if (collectionItem.assetTag?.loans.length) {
            return res.status(409).json({ error: "Check this item in before completing its sale" });
          }

          sourceExists = true;
          const membership = await prisma.collectionMember.findUnique({
            where: { userId_collectionId: { userId: req.user!.id, collectionId: collectionItem.collectionId } },
            select: { role: true }
          });

          if (!membership || (membership.role !== CollectionRole.OWNER && membership.role !== CollectionRole.EDITOR)) {
            return res.status(403).json({ error: "Editor or owner access is required to remove this item from its collection" });
          }
        }
      }

      const timestamp = now();
      const soldAt = body.soldAt || timestamp;
      const soldPrice = typeof body.soldPrice === "undefined" ? item.askingPrice : body.soldPrice;
      const notes = typeof body.notes === "undefined" ? item.notes : toStringOrNull(body.notes);
      const sourceRemovedAt = item.sourceType === "MANUAL" ? item.sourceRemovedAt : timestamp;

      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `
          UPDATE "SellListItem"
          SET "status" = 'SOLD',
              "soldPrice" = $1,
              "soldAt" = $2,
              "sourceRemovedAt" = $3,
              "notes" = $4,
              "updatedAt" = $5
          WHERE "id" = $6 AND "userId" = $7
          `,
          toNumberOrNull(soldPrice),
          soldAt,
          sourceRemovedAt,
          notes,
          timestamp,
          req.params.id,
          req.user!.id
        );

        if (sourceExists && item.sourceType === "GAME_COPY" && item.sourceId) {
          await tx.gameCopy.delete({ where: { id: item.sourceId } });
        }

        if (sourceExists && item.sourceType === "COLLECTION_ITEM" && item.sourceId) {
          await tx.collectionItem.delete({ where: { id: item.sourceId } });
        }
      });

      const rows = await prisma.$queryRawUnsafe<SellListRow[]>(
        'SELECT * FROM "SellListItem" WHERE "id" = $1 AND "userId" = $2 LIMIT 1',
        req.params.id,
        req.user!.id
      );

      res.json({ item: rows[0], removedFromCollection: sourceExists });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/sell-list/:id", async (req, res, next) => {
    try {
      await ensureTables();

      await prisma.$executeRawUnsafe(
        'DELETE FROM "SellListItem" WHERE "id" = $1 AND "userId" = $2',
        req.params.id,
        req.user!.id
      );

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

}
