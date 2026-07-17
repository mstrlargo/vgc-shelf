import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();
router.use(requireAuth);

type SearchResult = {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  url: string;
  assetTag?: string | null;
  status: string;
  matchedBy?: string[];
};

function includes(value: string | null | undefined, query: string) {
  return Boolean(value?.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
}

router.get("/", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ query: q, results: [] });

    const memberships = await prisma.collectionMember.findMany({
      where: { userId: req.user!.id },
      select: { collectionId: true }
    });
    const collectionIds = memberships.map((membership) => membership.collectionId);

    if (collectionIds.length === 0) {
      return res.json({ query: q, results: [] });
    }

    const ownedAssetFilter = {
      OR: [
        { gameCopy: { collectionId: { in: collectionIds } } },
        { collectionItem: { collectionId: { in: collectionIds } } }
      ]
    };

    const [collections, copies, items, assets, borrowerLoans] = await Promise.all([
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
        include: {
          collection: true,
          game: { include: { platform: true } },
          assetTag: { include: { loans: { where: { status: "CHECKED_OUT" }, take: 1 } } }
        },
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
        include: {
          collection: true,
          assetTag: { include: { loans: { where: { status: "CHECKED_OUT" }, take: 1 } } }
        },
        take: 25
      }),
      prisma.assetTag.findMany({
        where: {
          AND: [
            ownedAssetFilter,
            {
              OR: [
                { tag: { contains: q, mode: "insensitive" } },
                { gameCopy: { barcode: { contains: q, mode: "insensitive" } } },
                { collectionItem: { barcode: { contains: q, mode: "insensitive" } } }
              ]
            }
          ]
        },
        include: {
          gameCopy: { include: { collection: true, game: { include: { platform: true } } } },
          collectionItem: { include: { collection: true } },
          loans: { where: { status: "CHECKED_OUT" }, take: 1 }
        },
        take: 25
      }),
      prisma.loan.findMany({
        where: {
          AND: [
            {
              OR: [
                { borrowerName: { contains: q, mode: "insensitive" } },
                { borrowerEmail: { contains: q, mode: "insensitive" } }
              ]
            },
            { assetTag: ownedAssetFilter }
          ]
        },
        include: {
          assetTag: {
            include: {
              gameCopy: { include: { collection: true, game: { include: { platform: true } } } },
              collectionItem: { include: { collection: true } }
            }
          }
        },
        orderBy: { checkedOutAt: "desc" },
        take: 100
      })
    ]);

    const results: SearchResult[] = [];

    results.push(
      ...collections.map((collection) => ({
        type: "collection",
        id: collection.id,
        title: collection.name,
        subtitle: collection.type.replaceAll("_", " "),
        url: `/collections/${collection.id}`,
        status: "In collection",
        matchedBy: ["Collection"]
      }))
    );

    results.push(
      ...copies.map((copy) => {
        const matchedBy: string[] = [];
        if (includes(copy.barcode, q)) matchedBy.push("Barcode");
        if (includes(copy.game.title, q)) matchedBy.push("Title");
        if (includes(copy.game.platform?.name, q)) matchedBy.push("Platform");
        if (includes(copy.region, q)) matchedBy.push("Region");
        if (includes(copy.edition, q)) matchedBy.push("Edition");

        return {
          type: "game",
          id: copy.id,
          title: copy.game.title,
          subtitle: `${copy.collection.name} · ${copy.game.platform?.name || "Unknown platform"}`,
          url: copy.assetTag ? `/assets/${encodeURIComponent(copy.assetTag.tag)}` : `/collections/${copy.collectionId}`,
          assetTag: copy.assetTag?.tag || null,
          status: copy.assetTag?.loans?.[0]
            ? `Checked out to ${copy.assetTag.loans[0].borrowerName}`
            : "In collection",
          matchedBy
        };
      })
    );

    results.push(
      ...items.map((item) => {
        const matchedBy: string[] = [];
        if (includes(item.barcode, q)) matchedBy.push("Barcode");
        if (includes(item.name, q)) matchedBy.push("Name");
        if (includes(item.maker, q)) matchedBy.push("Maker");
        if (includes(item.platform, q)) matchedBy.push("Platform");
        if (includes(item.modelNumber, q)) matchedBy.push("Model number");
        if (includes(item.serialNumber, q)) matchedBy.push("Serial number");

        return {
          type: item.category.toLowerCase(),
          id: item.id,
          title: item.name,
          subtitle: `${item.collection.name}${item.platform ? ` · ${item.platform}` : ""}`,
          url: item.assetTag ? `/assets/${encodeURIComponent(item.assetTag.tag)}` : `/collections/${item.collectionId}`,
          assetTag: item.assetTag?.tag || null,
          status: item.assetTag?.loans?.[0]
            ? `Checked out to ${item.assetTag.loans[0].borrowerName}`
            : "In collection",
          matchedBy
        };
      })
    );

    results.push(
      ...assets.map((asset) => {
        const barcode = asset.gameCopy?.barcode || asset.collectionItem?.barcode || null;
        const matchedBy: string[] = [];
        if (includes(asset.tag, q)) matchedBy.push("Asset tag");
        if (includes(barcode, q)) matchedBy.push("Barcode");

        return {
          type: "asset",
          id: asset.id,
          title: asset.tag,
          subtitle: asset.gameCopy
            ? `${asset.gameCopy.game.title} · ${asset.gameCopy.collection.name}`
            : asset.collectionItem
              ? `${asset.collectionItem.name} · ${asset.collectionItem.collection.name}`
              : "Asset tag",
          url: `/assets/${encodeURIComponent(asset.tag)}`,
          assetTag: asset.tag,
          status: asset.loans?.[0]
            ? `Checked out to ${asset.loans[0].borrowerName}`
            : "In collection",
          matchedBy
        };
      })
    );

    const borrowers = new Map<string, {
      name: string;
      email: string | null;
      total: number;
      active: number;
      latest: Date;
      assetTags: Set<string>;
    }>();

    for (const loan of borrowerLoans) {
      const key = `${loan.borrowerName.trim().toLocaleLowerCase()}|${(loan.borrowerEmail || "").trim().toLocaleLowerCase()}`;
      const current = borrowers.get(key) || {
        name: loan.borrowerName,
        email: loan.borrowerEmail || null,
        total: 0,
        active: 0,
        latest: loan.checkedOutAt,
        assetTags: new Set<string>()
      };

      current.total += 1;
      if (loan.status === "CHECKED_OUT") current.active += 1;
      if (loan.checkedOutAt > current.latest) current.latest = loan.checkedOutAt;
      current.assetTags.add(loan.assetTag.tag);
      borrowers.set(key, current);
    }

    for (const [key, borrower] of borrowers) {
      const statusParts = [`${borrower.total} checkout${borrower.total === 1 ? "" : "s"}`];
      if (borrower.active) statusParts.push(`${borrower.active} active`);

      results.push({
        type: "borrower",
        id: key,
        title: borrower.name,
        subtitle: borrower.email || `${borrower.assetTags.size} associated asset${borrower.assetTags.size === 1 ? "" : "s"}`,
        url: `/lending?tab=history&search=${encodeURIComponent(borrower.email || borrower.name)}`,
        status: statusParts.join(" · "),
        matchedBy: [includes(borrower.email, q) ? "Borrower email" : "Borrower name"]
      });
    }

    const seen = new Set<string>();
    const deduplicated = results.filter((result) => {
      const key = `${result.type}:${result.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const priority = (result: SearchResult) => {
      if (result.matchedBy?.includes("Asset tag")) return 0;
      if (result.matchedBy?.includes("Barcode")) return 1;
      if (result.type === "borrower") return 2;
      return 3;
    };

    deduplicated.sort((a, b) => priority(a) - priority(b));

    res.json({ query: q, results: deduplicated.slice(0, 100) });
  } catch (err) {
    next(err);
  }
});

export default router;
