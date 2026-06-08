import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { ensureTables, id, now, sortWishlist, toNumberOrNull, toStringOrNull, WishlistRow } from "./listHelpers.js";

export function registerWishlistRoutes(router: Router) {
  const wishlistSchema = z.object({
    title: z.string().min(1).max(200),
    platform: z.string().nullable().optional(),
    category: z.enum(["GAME", "SYSTEM", "PERIPHERAL", "TOYS_TO_LIFE"]).default("GAME"),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
    targetPrice: z.union([z.number(), z.string()]).nullable().optional(),
    notes: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    barcode: z.string().nullable().optional()
  });


  router.get("/wishlist", async (req, res, next) => {
    try {
      await ensureTables();

      const sort = String(req.query.sort || "newest");

      const rows = await prisma.$queryRawUnsafe<WishlistRow[]>(
        'SELECT * FROM "WishlistItem" WHERE "userId" = $1',
        req.user!.id
      );

      res.json({
        items: sortWishlist(rows, sort)
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/wishlist", async (req, res, next) => {
    try {
      await ensureTables();

      const body = wishlistSchema.parse(req.body);
      const itemId = id();
      const timestamp = now();

      await prisma.$executeRawUnsafe(
        `
        INSERT INTO "WishlistItem"
        ("id", "userId", "title", "platform", "category", "priority", "targetPrice", "notes", "imageUrl", "barcode", "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `,
        itemId,
        req.user!.id,
        body.title.trim(),
        toStringOrNull(body.platform),
        body.category,
        body.priority,
        toNumberOrNull(body.targetPrice),
        toStringOrNull(body.notes),
        toStringOrNull(body.imageUrl),
        toStringOrNull(body.barcode),
        timestamp,
        timestamp
      );

      const rows = await prisma.$queryRawUnsafe<WishlistRow[]>(
        'SELECT * FROM "WishlistItem" WHERE "id" = $1 AND "userId" = $2 LIMIT 1',
        itemId,
        req.user!.id
      );

      res.status(201).json({
        item: rows[0]
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/wishlist/:id", async (req, res, next) => {
    try {
      await ensureTables();

      const body = wishlistSchema.partial().parse(req.body);
      const existing = await prisma.$queryRawUnsafe<WishlistRow[]>(
        'SELECT * FROM "WishlistItem" WHERE "id" = $1 AND "userId" = $2 LIMIT 1',
        req.params.id,
        req.user!.id
      );

      if (!existing[0]) return res.status(404).json({ error: "Wishlist item not found" });

      const nextItem = {
        ...existing[0],
        ...body
      };

      await prisma.$executeRawUnsafe(
        `
        UPDATE "WishlistItem"
        SET "title" = $1,
            "platform" = $2,
            "category" = $3,
            "priority" = $4,
            "targetPrice" = $5,
            "notes" = $6,
            "imageUrl" = $7,
            "barcode" = $8,
            "updatedAt" = $9
        WHERE "id" = $10 AND "userId" = $11
        `,
        String(nextItem.title).trim(),
        toStringOrNull(nextItem.platform),
        nextItem.category,
        nextItem.priority,
        toNumberOrNull(nextItem.targetPrice),
        toStringOrNull(nextItem.notes),
        toStringOrNull(nextItem.imageUrl),
        toStringOrNull(nextItem.barcode),
        now(),
        req.params.id,
        req.user!.id
      );

      const rows = await prisma.$queryRawUnsafe<WishlistRow[]>(
        'SELECT * FROM "WishlistItem" WHERE "id" = $1 AND "userId" = $2 LIMIT 1',
        req.params.id,
        req.user!.id
      );

      res.json({ item: rows[0] });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/wishlist/:id", async (req, res, next) => {
    try {
      await ensureTables();

      await prisma.$executeRawUnsafe(
        'DELETE FROM "WishlistItem" WHERE "id" = $1 AND "userId" = $2',
        req.params.id,
        req.user!.id
      );

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.post("/wishlist/:id/purchase", async (req, res, next) => {
    try {
      await ensureTables();

      const body = z.object({
        collectionId: z.string().min(1),
        format: z.enum(["PHYSICAL", "DIGITAL"]).default("PHYSICAL"),
        purchasePrice: z.union([z.string(), z.number()]).nullable().optional(),
        currentValue: z.union([z.string(), z.number()]).nullable().optional(),
        region: z.string().nullable().optional(),
        edition: z.string().nullable().optional(),
        condition: z.string().nullable().optional()
      }).parse(req.body);

      const wishlistRows = await prisma.$queryRawUnsafe<WishlistRow[]>(
        'SELECT * FROM "WishlistItem" WHERE "id" = $1 AND "userId" = $2 LIMIT 1',
        req.params.id,
        req.user!.id
      );

      const wishlistItem = wishlistRows[0];

      if (!wishlistItem) return res.status(404).json({ error: "Wishlist item not found" });

      const membership = await prisma.collectionMember.findFirst({
        where: {
          collectionId: body.collectionId,
          userId: req.user!.id
        },
        include: {
          collection: true
        }
      });

      if (!membership) return res.status(403).json({ error: "You do not have access to this collection" });

      if (membership.collection.type === "GAMES") {
        let platformId: string | undefined;

        if (wishlistItem.platform) {
          const platform = await prisma.platform.upsert({
            where: {
              name: wishlistItem.platform
            },
            update: {},
            create: {
              name: wishlistItem.platform
            }
          });

          platformId = platform.id;
        }

        const game = await prisma.game.create({
          data: {
            title: wishlistItem.title,
            platformId,
            coverUrl: wishlistItem.imageUrl || undefined,
            description: wishlistItem.notes || undefined
          }
        });

        const copy = await prisma.gameCopy.create({
          data: {
            collectionId: body.collectionId,
            gameId: game.id,
            format: body.format,
            barcode: wishlistItem.barcode || undefined,
            region: toStringOrNull(body.region) || undefined,
            edition: toStringOrNull(body.edition) || undefined,
            purchasePrice: toNumberOrNull(body.purchasePrice) ?? undefined,
            estimatedValue: toNumberOrNull(body.currentValue) ?? undefined,
            notes: wishlistItem.notes || undefined
          }
        });

        await prisma.$executeRawUnsafe(
          'DELETE FROM "WishlistItem" WHERE "id" = $1 AND "userId" = $2',
          req.params.id,
          req.user!.id
        );

        return res.status(201).json({
          type: "game",
          item: copy
        });
      }

      const category =
        membership.collection.type === "SYSTEMS"
          ? "SYSTEM"
          : membership.collection.type === "PERIPHERALS"
            ? "PERIPHERAL"
            : "TOYS_TO_LIFE";

      const item = await prisma.collectionItem.create({
        data: {
          collectionId: body.collectionId,
          category,
          name: wishlistItem.title,
          platform: wishlistItem.platform || undefined,
          barcode: wishlistItem.barcode || undefined,
          condition: (toStringOrNull(body.condition) || "GOOD") as any,
          purchasePrice: toNumberOrNull(body.purchasePrice) ?? undefined,
          estimatedValue: toNumberOrNull(body.currentValue) ?? undefined,
          imageUrl: wishlistItem.imageUrl || undefined,
          notes: wishlistItem.notes || undefined
        }
      });

      await prisma.$executeRawUnsafe(
        'DELETE FROM "WishlistItem" WHERE "id" = $1 AND "userId" = $2',
        req.params.id,
        req.user!.id
      );

      res.status(201).json({
        type: "item",
        item
      });
    } catch (err) {
      next(err);
    }
  });

}
