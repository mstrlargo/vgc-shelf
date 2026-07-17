import { Router } from "express";
import { z } from "zod";
import { CollectionRole, CollectionType } from "@prisma/client";
import { prisma } from "../db.js";
import { compactTitleKey, normalizeText } from "../lib/normalization.js";
import { requireAuth, requireCollectionRole } from "../auth.js";

const router = Router();

router.use(requireAuth);

function cleanString(value: string | null | undefined) {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const assetTagInclude = {
  loans: {
    orderBy: { checkedOutAt: "desc" as const },
    include: {
      checkedOutBy: {
        select: { id: true, email: true, name: true }
      }
    }
  }
};

router.get("/", async (req, res, next) => {
  try {
    const memberships = await prisma.collectionMember.findMany({
      where: { userId: req.user!.id },
      include: {
        collection: {
          include: {
            _count: { select: { copies: true, members: true, items: true } }
          }
        }
      }
    });

    memberships.sort((a, b) => {
      if (a.collection.isArchived !== b.collection.isArchived) return a.collection.isArchived ? 1 : -1;
      if (a.collection.isPinned !== b.collection.isPinned) return a.collection.isPinned ? -1 : 1;
      if (a.collection.sortOrder !== b.collection.sortOrder) return a.collection.sortOrder - b.collection.sortOrder;
      return a.collection.name.localeCompare(b.collection.name);
    });

    const collectionIds = memberships.map((m) => m.collectionId);

    const activeAssetTags = collectionIds.length
      ? await prisma.assetTag.findMany({
          where: {
            loans: { some: { status: "CHECKED_OUT" } },
            OR: [
              { gameCopy: { is: { collectionId: { in: collectionIds } } } },
              { collectionItem: { is: { collectionId: { in: collectionIds } } } }
            ]
          },
          select: {
            gameCopy: { select: { collectionId: true } },
            collectionItem: { select: { collectionId: true } }
          }
        })
      : [];

    const checkedOutCounts = activeAssetTags.reduce<Record<string, number>>((counts, assetTag) => {
      const collectionId = assetTag.gameCopy?.collectionId || assetTag.collectionItem?.collectionId;
      if (!collectionId) return counts;
      counts[collectionId] = (counts[collectionId] || 0) + 1;
      return counts;
    }, {});

    res.json({
      collections: memberships.map((m) => ({
        ...m.collection,
        role: m.role,
        checkedOutCount: checkedOutCounts[m.collectionId] || 0
      }))
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      imageUrl: z.string().nullable().optional(),
      type: z.nativeEnum(CollectionType).default(CollectionType.GAMES)
    }).parse(req.body);

    const highestOrder = await prisma.collection.aggregate({
      _max: { sortOrder: true }
    });

    const collection = await prisma.collection.create({
      data: {
        name: body.name,
        description: body.description,
        imageUrl: cleanString(body.imageUrl),
        type: body.type,
        sortOrder: (highestOrder._max.sortOrder ?? -1) + 1,
        members: {
          create: {
            userId: req.user!.id,
            role: CollectionRole.OWNER
          }
        }
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, name: true, role: true } }
          }
        },
        _count: {
          select: { copies: true, members: true, items: true }
        }
      }
    });

    res.status(201).json({ collection });
  } catch (err) {
    next(err);
  }
});

router.patch("/order", async (req, res, next) => {
  try {
    const body = z.object({
      collectionIds: z.array(z.string().min(1)).min(1)
    }).parse(req.body);

    const memberships = await prisma.collectionMember.findMany({
      where: {
        userId: req.user!.id,
        collectionId: { in: body.collectionIds },
        role: { in: [CollectionRole.OWNER, CollectionRole.EDITOR] }
      },
      select: { collectionId: true }
    });

    const editableIds = new Set(memberships.map((membership) => membership.collectionId));
    if (body.collectionIds.some((id) => !editableIds.has(id))) {
      return res.status(403).json({ error: "Editor or owner access required for every reordered collection" });
    }

    await prisma.$transaction(
      body.collectionIds.map((id, index) =>
        prisma.collection.update({
          where: { id },
          data: { sortOrder: index }
        })
      )
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const membership = await requireCollectionRole(req.params.id, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR,
      CollectionRole.VIEWER
    ]);

    if (!membership) return res.status(403).json({ error: "No access to collection" });

    const collection = await prisma.collection.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, name: true, role: true } }
          },
          orderBy: { createdAt: "asc" }
        },
        copies: {
          include: {
            game: { include: { platform: true } },
            parts: { orderBy: { createdAt: "asc" } },
            assetTag: { include: assetTagInclude }
          },
          orderBy: { createdAt: "desc" }
        },
        items: {
          include: {
            parts: { orderBy: { createdAt: "asc" } },
            assetTag: { include: assetTagInclude }
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    res.json({ collection, role: membership.role });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const membership = await requireCollectionRole(req.params.id, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR
    ]);

    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    const body = z.object({
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      imageUrl: z.string().nullable().optional(),
      type: z.nativeEnum(CollectionType).optional(),
      isPinned: z.boolean().optional(),
      isArchived: z.boolean().optional()
    }).parse(req.body);

    const collection = await prisma.collection.update({
      where: { id: req.params.id },
      data: {
        name: body.name,
        description: typeof body.description === "undefined" ? undefined : cleanString(body.description),
        imageUrl: typeof body.imageUrl === "undefined" ? undefined : cleanString(body.imageUrl),
        type: body.type,
        isPinned: body.isPinned,
        isArchived: body.isArchived,
        archivedAt: typeof body.isArchived === "undefined" ? undefined : body.isArchived ? new Date() : null
      }
    });

    res.json({ collection });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const membership = await requireCollectionRole(req.params.id, req.user!.id, [CollectionRole.OWNER]);

    if (!membership) return res.status(403).json({ error: "Owner access required" });

    await prisma.collection.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/:id/members", async (req, res, next) => {
  try {
    const membership = await requireCollectionRole(req.params.id, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR
    ]);

    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    const body = z.object({
      email: z.string().email(),
      role: z.nativeEnum(CollectionRole).default(CollectionRole.VIEWER)
    }).parse(req.body);

    if (body.role === CollectionRole.OWNER && membership.role !== CollectionRole.OWNER) {
      return res.status(403).json({ error: "Only owners can add another owner" });
    }

    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });

    if (!user) return res.status(404).json({ error: "User not found" });

    const member = await prisma.collectionMember.upsert({
      where: {
        userId_collectionId: {
          userId: user.id,
          collectionId: req.params.id
        }
      },
      update: { role: body.role },
      create: {
        userId: user.id,
        collectionId: req.params.id,
        role: body.role
      },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } }
      }
    });

    res.status(201).json({ member });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/members/:userId", async (req, res, next) => {
  try {
    const membership = await requireCollectionRole(req.params.id, req.user!.id, [CollectionRole.OWNER]);

    if (!membership) return res.status(403).json({ error: "Owner access required" });

    const body = z.object({
      role: z.nativeEnum(CollectionRole)
    }).parse(req.body);

    const member = await prisma.collectionMember.update({
      where: {
        userId_collectionId: {
          userId: req.params.userId,
          collectionId: req.params.id
        }
      },
      data: { role: body.role },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } }
      }
    });

    res.json({ member });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id/members/:userId", async (req, res, next) => {
  try {
    const membership = await requireCollectionRole(req.params.id, req.user!.id, [CollectionRole.OWNER]);

    if (!membership) return res.status(403).json({ error: "Owner access required" });

    await prisma.collectionMember.delete({
      where: {
        userId_collectionId: {
          userId: req.params.userId,
          collectionId: req.params.id
        }
      }
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const partSchema = z.object({
  type: z.enum(["DISC", "CARTRIDGE", "BOX", "MANUAL", "INSERT", "COVER_ART", "STEELBOOK", "AMIIBO", "SEALED", "OTHER"]),
  condition: z.enum(["NEW", "LIKE_NEW", "VERY_GOOD", "GOOD", "ACCEPTABLE", "POOR", "MISSING"]).default("GOOD"),
  notes: z.string().optional().nullable()
});

const createGameForCollectionSchema = z.object({
  title: z.string().min(1),
  platformId: z.string().optional(),
  platformName: z.string().min(1).optional(),
  platformMaker: z.string().optional(),
  releaseYear: z.number().int().min(1950).max(2100).optional(),
  description: z.string().optional(),
  coverUrl: z.string().url().optional(),
  format: z.enum(["PHYSICAL", "DIGITAL"]).default("PHYSICAL"),
  barcode: z.string().optional(),
  region: z.string().optional(),
  edition: z.string().optional(),
  purchasePrice: z.number().nonnegative().optional(),
  estimatedValue: z.number().nonnegative().optional(),
  priceChartingProductId: z.string().optional().nullable(),
  priceChartingProductName: z.string().optional().nullable(),
  priceChartingConsoleName: z.string().optional().nullable(),
  notes: z.string().optional(),
  parts: z.array(partSchema).optional()
});

router.post("/:id/games", async (req, res, next) => {
  try {
    const membership = await requireCollectionRole(req.params.id, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR
    ]);

    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    const collection = await prisma.collection.findUnique({
      where: { id: req.params.id },
      select: { type: true }
    });

    if (!collection) return res.status(404).json({ error: "Collection not found" });

    if (collection.type !== CollectionType.GAMES) {
      return res.status(400).json({ error: "Games can only be added to Games collections" });
    }

    const body = createGameForCollectionSchema.parse(req.body);

    let platformId = body.platformId;

    if (!platformId && body.platformName) {
      const platform = await prisma.platform.upsert({
        where: { name: body.platformName.trim() },
        update: { maker: body.platformMaker },
        create: { name: body.platformName.trim(), maker: body.platformMaker }
      });

      platformId = platform.id;
    }

    const titleKey = compactTitleKey(body.title);
    const existingGames = await prisma.game.findMany({
      where: {
        platformId: platformId || null,
        title: { contains: body.title.trim(), mode: "insensitive" }
      },
      include: { platform: true },
      take: 25
    });

    const existingGame = existingGames.find((candidate) => compactTitleKey(candidate.title) === titleKey);

    const game = existingGame || await prisma.game.create({
      data: {
        title: body.title.trim(),
        description: body.description,
        releaseYear: body.releaseYear,
        coverUrl: body.coverUrl,
        platformId
      }
    });

    if (existingGame && (body.description || body.coverUrl || body.releaseYear)) {
      await prisma.game.update({
        where: { id: existingGame.id },
        data: {
          description: existingGame.description || body.description,
          coverUrl: existingGame.coverUrl || body.coverUrl,
          releaseYear: existingGame.releaseYear || body.releaseYear
        }
      });
    }

    const copy = await prisma.gameCopy.create({
      data: {
        collectionId: req.params.id,
        gameId: game.id,
        format: body.format,
        barcode: cleanString(body.barcode),
        region: cleanString(body.region),
        edition: cleanString(body.edition),
        purchasePrice: body.purchasePrice,
        estimatedValue: body.estimatedValue,
        priceChartingProductId: cleanString(body.priceChartingProductId),
        priceChartingProductName: cleanString(body.priceChartingProductName),
        priceChartingConsoleName: cleanString(body.priceChartingConsoleName),
        notes: cleanString(body.notes),
        parts: body.parts ? {
          create: body.parts.map((part) => ({
            type: part.type,
            condition: part.condition,
            notes: cleanString(part.notes)
          }))
        } : undefined
      },
      include: {
        game: { include: { platform: true } },
        parts: true,
        assetTag: { include: assetTagInclude }
      }
    });

    res.status(201).json({ game, copy });
  } catch (err) {
    next(err);
  }
});

export default router;
