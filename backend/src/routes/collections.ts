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
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({
      collections: memberships.map((m) => ({
        ...m.collection,
        role: m.role
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

    const collection = await prisma.collection.create({
      data: {
        name: body.name,
        description: body.description,
        imageUrl: cleanString(body.imageUrl),
        type: body.type,
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
      type: z.nativeEnum(CollectionType).optional()
    }).parse(req.body);

    const collection = await prisma.collection.update({
      where: { id: req.params.id },
      data: {
        name: body.name,
        description: typeof body.description === "undefined" ? undefined : cleanString(body.description),
        imageUrl: typeof body.imageUrl === "undefined" ? undefined : cleanString(body.imageUrl),
        type: body.type
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
  type: z.enum(["DISC", "CARTRIDGE", "CASE", "BOX", "MANUAL", "INSERT", "COVER_ART", "STEELBOOK", "AMIIBO", "OTHER"]),
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
