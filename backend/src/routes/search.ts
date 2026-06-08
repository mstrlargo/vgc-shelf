import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ query: q, results: [] });

    const memberships = await prisma.collectionMember.findMany({
      where: { userId: req.user!.id },
      select: { collectionId: true }
    });
    const collectionIds = memberships.map((m) => m.collectionId);

    const [collections, copies, items, assets] = await Promise.all([
      prisma.collection.findMany({
        where: {
          id: { in: collectionIds },
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } }
          ]
        },
        take: 25
      }),
      prisma.gameCopy.findMany({
        where: {
          collectionId: { in: collectionIds },
          OR: [
            { barcode: { contains: q, mode: "insensitive" } },
            { region: { contains: q, mode: "insensitive" } },
            { edition: { contains: q, mode: "insensitive" } },
            { game: { title: { contains: q, mode: "insensitive" } } },
            { game: { platform: { name: { contains: q, mode: "insensitive" } } } }
          ]
        },
        include: { collection: true, game: { include: { platform: true } }, assetTag: { include: { loans: { where: { status: "CHECKED_OUT" }, take: 1 } } } },
        take: 25
      }),
      prisma.collectionItem.findMany({
        where: {
          collectionId: { in: collectionIds },
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { maker: { contains: q, mode: "insensitive" } },
            { platform: { contains: q, mode: "insensitive" } },
            { modelNumber: { contains: q, mode: "insensitive" } },
            { serialNumber: { contains: q, mode: "insensitive" } },
            { barcode: { contains: q, mode: "insensitive" } }
          ]
        },
        include: { collection: true, assetTag: { include: { loans: { where: { status: "CHECKED_OUT" }, take: 1 } } } },
        take: 25
      }),
      prisma.assetTag.findMany({
        where: {
          tag: { contains: q, mode: "insensitive" },
          OR: [
            { gameCopy: { collectionId: { in: collectionIds } } },
            { collectionItem: { collectionId: { in: collectionIds } } }
          ]
        },
        include: {
          gameCopy: { include: { collection: true, game: { include: { platform: true } } } },
          collectionItem: { include: { collection: true } },
          loans: { where: { status: "CHECKED_OUT" }, take: 1 }
        },
        take: 25
      })
    ]);

    const results = [
      ...collections.map((c) => ({ type: "collection", id: c.id, title: c.name, subtitle: c.type.replaceAll("_", " "), url: `/collections/${c.id}`, status: "In collection" })),
      ...copies.map((c) => ({ type: "game", id: c.id, title: c.game.title, subtitle: `${c.collection.name} · ${c.game.platform?.name || "Unknown platform"}`, url: `/collections/${c.collectionId}`, assetTag: c.assetTag?.tag || null, status: c.assetTag?.loans?.[0] ? `Checked out to ${c.assetTag.loans[0].borrowerName}` : "In collection" })),
      ...items.map((i) => ({ type: i.category.toLowerCase(), id: i.id, title: i.name, subtitle: `${i.collection.name}${i.platform ? ` · ${i.platform}` : ""}`, url: `/collections/${i.collectionId}`, assetTag: i.assetTag?.tag || null, status: i.assetTag?.loans?.[0] ? `Checked out to ${i.assetTag.loans[0].borrowerName}` : "In collection" })),
      ...assets.map((a) => ({ type: "asset", id: a.id, title: a.tag, subtitle: a.gameCopy ? `${a.gameCopy.game.title} · ${a.gameCopy.collection.name}` : a.collectionItem ? `${a.collectionItem.name} · ${a.collectionItem.collection.name}` : "Asset tag", url: a.gameCopy ? `/collections/${a.gameCopy.collectionId}` : a.collectionItem ? `/collections/${a.collectionItem.collectionId}` : `/assets/${a.tag}`, assetTag: a.tag, status: a.loans?.[0] ? `Checked out to ${a.loans[0].borrowerName}` : "In collection" }))
    ];

    res.json({ query: q, results });
  } catch (err) {
    next(err);
  }
});

export default router;
