import { Router } from "express";
import { z } from "zod";
import { AssetLabelStatus, CollectionRole, CollectionType, LoanStatus } from "@prisma/client";
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

function normalizeAssetTagPrefix(value: string | null | undefined) {
  const normalized = (value || "VGC").replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase();
  return normalized.length === 3 ? normalized : "VGC";
}

function suffixForType(type: CollectionType) {
  if (type === CollectionType.GAMES) return "GAME";
  if (type === CollectionType.SYSTEMS) return "SYS";
  if (type === CollectionType.PERIPHERALS) return "PER";
  if (type === CollectionType.TOYS_TO_LIFE) return "TOY";
  return "ASSET";
}

function assetInclude() {
  return {
    gameCopy: {
      include: {
        collection: true,
        game: { include: { platform: true } },
        parts: true
      }
    },
    collectionItem: {
      include: { collection: true }
    },
    loans: {
      orderBy: { checkedOutAt: "desc" as const },
      include: {
        checkedOutBy: {
          select: { id: true, email: true, name: true }
        }
      }
    }
  };
}

async function getSettings() {
  return prisma.appSetting.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      allowPublicSignup: true,
      appName: "VGC Shelf",
      pageTitle: "VGC Shelf",
      assetTagPrefix: "VGC"
    }
  });
}

async function nextAssetTagForCollectionType(type: CollectionType) {
  const settings = await getSettings();
  const prefix = `${normalizeAssetTagPrefix(settings.assetTagPrefix)}-${suffixForType(type)}`;

  const existing = await prisma.assetTag.findMany({
    where: {
      tag: {
        startsWith: `${prefix}-`
      }
    },
    select: {
      tag: true
    }
  });

  let maxNumber = 0;
  const matcher = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`);

  for (const asset of existing) {
    const match = asset.tag.match(matcher);
    if (!match) continue;

    const parsed = Number(match[1]);

    if (Number.isFinite(parsed) && parsed > maxNumber) {
      maxNumber = parsed;
    }
  }

  return `${prefix}-${String(maxNumber + 1).padStart(4, "0")}`;
}

function parseDueAt(value: string | null | undefined) {
  const cleaned = cleanString(value);

  if (!cleaned) return undefined;

  const dateOnlyMatch = /^\\d{4}-\\d{2}-\\d{2}$/.test(cleaned);
  const parsed = new Date(dateOnlyMatch ? `${cleaned}T12:00:00.000Z` : cleaned);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

async function getAssetAccess(assetTagId: string, userId: string, roles: CollectionRole[]) {
  const asset = await prisma.assetTag.findUnique({
    where: { id: assetTagId },
    include: {
      gameCopy: { select: { collectionId: true } },
      collectionItem: { select: { collectionId: true } }
    }
  });

  if (!asset) return { asset: null, membership: null };

  const collectionId = asset.gameCopy?.collectionId || asset.collectionItem?.collectionId;
  if (!collectionId) return { asset, membership: null };

  const membership = await requireCollectionRole(collectionId, userId, roles);
  return { asset, membership };
}

async function getAssetByTagWithAccess(tag: string, userId: string, roles: CollectionRole[]) {
  const asset = await prisma.assetTag.findUnique({
    where: { tag },
    include: {
      gameCopy: { select: { collectionId: true } },
      collectionItem: { select: { collectionId: true } }
    }
  });

  if (!asset) return { asset: null, membership: null };

  const collectionId = asset.gameCopy?.collectionId || asset.collectionItem?.collectionId;
  if (!collectionId) return { asset, membership: null };

  const membership = await requireCollectionRole(collectionId, userId, roles);
  return { asset, membership };
}

router.get("/", async (req, res, next) => {
  try {
    const memberships = await prisma.collectionMember.findMany({
      where: { userId: req.user!.id },
      select: { collectionId: true }
    });

    const collectionIds = memberships.map((membership) => membership.collectionId);

    const assets = await prisma.assetTag.findMany({
      where: {
        OR: [
          { gameCopy: { collectionId: { in: collectionIds } } },
          { collectionItem: { collectionId: { in: collectionIds } } }
        ]
      },
      include: assetInclude(),
      orderBy: { createdAt: "desc" }
    });

    res.json({ assets });
  } catch (err) {
    next(err);
  }
});

router.get("/next-tag", async (req, res, next) => {
  try {
    const type = z.nativeEnum(CollectionType).parse(req.query.type || CollectionType.GAMES);
    const settings = await getSettings();
    const prefix = `${normalizeAssetTagPrefix(settings.assetTagPrefix)}-${suffixForType(type)}`;

    const existing = await prisma.assetTag.findMany({
      where: { tag: { startsWith: `${prefix}-` } },
      select: { tag: true }
    });

    let maxNumber = 0;
    const matcher = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`);

    for (const asset of existing) {
      const match = asset.tag.match(matcher);
      if (!match) continue;
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > maxNumber) maxNumber = parsed;
    }

    const nextNumber = maxNumber + 1;
    const tag = `${prefix}-${String(nextNumber).padStart(4, "0")}`;

    res.json({
      tag,
      prefix,
      nextNumber,
      assetTagPrefix: normalizeAssetTagPrefix(settings.assetTagPrefix)
    });
  } catch (err) {
    next(err);
  }
});

router.get("/eligible", async (req, res, next) => {
  try {
    const memberships = await prisma.collectionMember.findMany({
      where: { userId: req.user!.id },
      select: { collectionId: true }
    });

    const collectionIds = memberships.map((membership) => membership.collectionId);

    const [gameCopies, collectionItems] = await Promise.all([
      prisma.gameCopy.findMany({
        where: {
          collectionId: { in: collectionIds },
          assetTag: null,
          collection: { type: CollectionType.GAMES }
        },
        include: {
          collection: true,
          game: { include: { platform: true } }
        },
        orderBy: { createdAt: "desc" }
      }),
      prisma.collectionItem.findMany({
        where: {
          collectionId: { in: collectionIds },
          assetTag: null,
          collection: {
            type: { in: [CollectionType.SYSTEMS, CollectionType.PERIPHERALS, CollectionType.TOYS_TO_LIFE] }
          }
        },
        include: { collection: true },
        orderBy: { createdAt: "desc" }
      })
    ]);

    res.json({ gameCopies, collectionItems });
  } catch (err) {
    next(err);
  }
});

router.get("/lookup/:tag", async (req, res, next) => {
  try {
    const { asset, membership } = await getAssetByTagWithAccess(req.params.tag, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR,
      CollectionRole.VIEWER
    ]);

    if (!asset) return res.status(404).json({ error: "Asset tag not found" });
    if (!membership) return res.status(403).json({ error: "No access to asset" });

    const fullAsset = await prisma.assetTag.findUnique({
      where: { tag: req.params.tag },
      include: assetInclude()
    });

    const activeLoan = await prisma.loan.findFirst({
      where: { assetTagId: asset.id, status: LoanStatus.CHECKED_OUT },
      orderBy: { checkedOutAt: "desc" }
    });

    res.json({ asset: fullAsset, activeLoan });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = z.object({
      tag: z.string().min(1).max(80).optional().nullable(),
      type: z.string().optional().nullable(),
      assetType: z.string().optional().nullable(),
      entityType: z.string().optional().nullable(),
      gameCopyId: z.string().optional().nullable(),
      collectionItemId: z.string().optional().nullable(),
      notes: z.string().optional().nullable()
    }).parse(req.body);

    if (!!body.gameCopyId === !!body.collectionItemId) {
      return res.status(400).json({ error: "Provide exactly one of gameCopyId or collectionItemId" });
    }

    let collectionId: string | null = null;

    if (body.gameCopyId) {
      const copy = await prisma.gameCopy.findUnique({ where: { id: body.gameCopyId }, select: { collectionId: true } });
      if (!copy) return res.status(404).json({ error: "Game copy not found" });
      collectionId = copy.collectionId;
    }

    if (body.collectionItemId) {
      const item = await prisma.collectionItem.findUnique({ where: { id: body.collectionItemId }, select: { collectionId: true } });
      if (!item) return res.status(404).json({ error: "Collection item not found" });
      collectionId = item.collectionId;
    }

    const membership = await requireCollectionRole(collectionId!, req.user!.id, [CollectionRole.OWNER, CollectionRole.EDITOR]);
    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    const collection = await prisma.collection.findUnique({
      where: { id: collectionId! },
      select: { type: true }
    });

    if (!collection) return res.status(404).json({ error: "Collection not found" });

    const tag = cleanString(body.tag)?.toUpperCase() || await nextAssetTagForCollectionType(collection.type);

    const asset = await prisma.assetTag.create({
      data: {
        tag,
        gameCopyId: body.gameCopyId || undefined,
        collectionItemId: body.collectionItemId || undefined,
        notes: cleanString(body.notes)
      },
      include: assetInclude()
    });

    res.status(201).json({ asset });
  } catch (err: any) {
    if (err?.code === "P2002") return res.status(409).json({ error: "Asset tag already exists or item already has a tag" });
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { asset, membership } = await getAssetAccess(req.params.id, req.user!.id, [CollectionRole.OWNER, CollectionRole.EDITOR]);
    if (!asset) return res.status(404).json({ error: "Asset tag not found" });
    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    const body = z.object({
      tag: z.string().min(1).max(80).optional(),
      notes: z.string().optional().nullable()
    }).parse(req.body);

    const updated = await prisma.assetTag.update({
      where: { id: req.params.id },
      data: {
        tag: body.tag?.trim().toUpperCase(),
        notes: typeof body.notes === "undefined" ? undefined : cleanString(body.notes)
      },
      include: assetInclude()
    });

    res.json({ asset: updated });
  } catch (err: any) {
    if (err?.code === "P2002") return res.status(409).json({ error: "Asset tag already exists" });
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { asset, membership } = await getAssetAccess(req.params.id, req.user!.id, [CollectionRole.OWNER, CollectionRole.EDITOR]);
    if (!asset) return res.status(404).json({ error: "Asset tag not found" });
    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    await prisma.assetTag.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post("/:id/checkout", async (req, res, next) => {
  try {
    const { asset, membership } = await getAssetAccess(req.params.id, req.user!.id, [CollectionRole.OWNER, CollectionRole.EDITOR]);
    if (!asset) return res.status(404).json({ error: "Asset tag not found" });
    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    const activeLoan = await prisma.loan.findFirst({
      where: {
        assetTagId: req.params.id,
        status: LoanStatus.CHECKED_OUT,
        returnedAt: null
      }
    });

    if (activeLoan) return res.status(409).json({ error: "Asset is already checked out" });

    const body = z.object({
      borrowerName: z.string().min(1),
      borrowerEmail: z.string().email().optional().nullable(),
      dueAt: z.string().optional().nullable(),
      checkoutNotes: z.string().optional().nullable(),
      notes: z.string().optional().nullable()
    }).parse(req.body);

    const loan = await prisma.loan.create({
      data: {
        assetTagId: req.params.id,
        checkedOutByUserId: req.user!.id,
        borrowerName: body.borrowerName,
        borrowerEmail: cleanString(body.borrowerEmail),
        dueAt: parseDueAt(body.dueAt),
        checkoutNotes: cleanString(body.checkoutNotes ?? body.notes)
      }
    });

    res.status(201).json({ loan });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/checkin", async (req, res, next) => {
  try {
    const { asset, membership } = await getAssetAccess(req.params.id, req.user!.id, [CollectionRole.OWNER, CollectionRole.EDITOR]);
    if (!asset) return res.status(404).json({ error: "Asset tag not found" });
    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    const activeLoan = await prisma.loan.findFirst({
      where: {
        assetTagId: req.params.id,
        status: LoanStatus.CHECKED_OUT,
        returnedAt: null
      },
      orderBy: { checkedOutAt: "desc" }
    });

    if (!activeLoan) return res.status(404).json({ error: "Asset is not currently checked out" });

    const body = z.object({ returnNotes: z.string().optional().nullable() }).parse(req.body);

    const loan = await prisma.loan.update({
      where: { id: activeLoan.id },
      data: {
        status: LoanStatus.RETURNED,
        returnedAt: new Date(),
        returnNotes: cleanString(body.returnNotes)
      }
    });

    res.json({ loan });
  } catch (err) {
    next(err);
  }
});


router.patch("/:id/label-status", async (req, res, next) => {
  try {
    const body = z.object({
      status: z.nativeEnum(AssetLabelStatus)
    }).parse(req.body);

    const { asset, membership } = await getAssetAccess(req.params.id, req.user!.id, [
      CollectionRole.OWNER,
      CollectionRole.EDITOR
    ]);

    if (!asset) return res.status(404).json({ error: "Asset tag not found" });
    if (!membership) return res.status(403).json({ error: "Editor or owner access required" });

    const updated = await prisma.assetTag.update({
      where: { id: asset.id },
      data: { labelStatus: body.status },
      include: assetInclude()
    });

    res.json({ asset: updated });
  } catch (err) {
    next(err);
  }
});

router.post("/labels/printed", async (req, res, next) => {
  try {
    const body = z.object({
      assetIds: z.array(z.string().min(1)).min(1).max(500)
    }).parse(req.body);

    const uniqueIds = [...new Set(body.assetIds)];
    const assets = await prisma.assetTag.findMany({
      where: { id: { in: uniqueIds } },
      include: {
        gameCopy: { select: { collectionId: true } },
        collectionItem: { select: { collectionId: true } }
      }
    });

    if (assets.length !== uniqueIds.length) {
      return res.status(404).json({ error: "One or more asset tags were not found" });
    }

    for (const asset of assets) {
      const collectionId = asset.gameCopy?.collectionId || asset.collectionItem?.collectionId;
      if (!collectionId) return res.status(403).json({ error: "Asset is not assigned to a collection" });
      const membership = await requireCollectionRole(collectionId, req.user!.id, [
        CollectionRole.OWNER,
        CollectionRole.EDITOR
      ]);
      if (!membership) return res.status(403).json({ error: "Editor or owner access required" });
    }

    const printedAt = new Date();
    await prisma.assetTag.updateMany({
      where: { id: { in: uniqueIds } },
      data: {
        labelStatus: AssetLabelStatus.NORMAL,
        labelLastPrintedAt: printedAt
      }
    });

    res.json({ updated: uniqueIds.length, printedAt });
  } catch (err) {
    next(err);
  }
});

export default router;
