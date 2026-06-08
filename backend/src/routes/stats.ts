import { Router } from "express";
import { requireAuth } from "../auth.js";
import { prisma } from "../db.js";

const router = Router();

router.use(requireAuth);

router.get("/dashboard", async (req, res, next) => {
  try {
    const memberships = await prisma.collectionMember.findMany({
      where: { userId: req.user!.id },
      select: { collectionId: true }
    });

    const collectionIds = memberships.map((membership) => membership.collectionId);

    if (collectionIds.length === 0) {
      return res.json({
        stats: {
          collections: 0,
          copies: 0,
          uniqueGames: 0,
          platforms: 0,
          physicalCopies: 0,
          digitalCopies: 0,
          inventoryItems: 0,
          systems: 0,
          peripherals: 0,
          toysToLife: 0,
          estimatedValue: 0,
          purchasePrice: 0,
          valueDelta: 0,
          conditionCounts: [],
          platformCounts: []
        }
      });
    }

    const [copies, items] = await Promise.all([
      prisma.gameCopy.findMany({
        where: { collectionId: { in: collectionIds } },
        include: {
          game: { include: { platform: true } },
          parts: true
        }
      }),
      prisma.collectionItem.findMany({
        where: { collectionId: { in: collectionIds } }
      })
    ]);

    const gameIds = new Set<string>();
    const platformIds = new Set<string>();
    const platformMap = new Map<string, { platform: string; copies: number }>();
    const conditionMap = new Map<string, number>();

    let physicalCopies = 0;
    let digitalCopies = 0;
    let estimatedValue = 0;
    let purchasePrice = 0;

    for (const copy of copies) {
      gameIds.add(copy.gameId);

      if (copy.format === "PHYSICAL") physicalCopies += 1;
      if (copy.format === "DIGITAL") digitalCopies += 1;

      if (copy.estimatedValue) estimatedValue += Number(copy.estimatedValue);
      if (copy.purchasePrice) purchasePrice += Number(copy.purchasePrice);

      if (copy.game.platform) {
        platformIds.add(copy.game.platform.id);
        const key = copy.game.platform.name;
        const current = platformMap.get(key) || { platform: key, copies: 0 };
        current.copies += 1;
        platformMap.set(key, current);
      }

      for (const part of copy.parts) {
        conditionMap.set(part.condition, (conditionMap.get(part.condition) || 0) + 1);
      }
    }

    let systems = 0;
    let peripherals = 0;
    let toysToLife = 0;

    for (const item of items) {
      if (item.estimatedValue) estimatedValue += Number(item.estimatedValue);
      if (item.purchasePrice) purchasePrice += Number(item.purchasePrice);
      conditionMap.set(item.condition, (conditionMap.get(item.condition) || 0) + 1);

      if (item.category === "SYSTEM") systems += 1;
      if (item.category === "PERIPHERAL") peripherals += 1;
      if (item.category === "TOYS_TO_LIFE") toysToLife += 1;
    }

    const platformCounts = Array.from(platformMap.values()).sort((a, b) => b.copies - a.copies);
    const conditionCounts = Array.from(conditionMap.entries())
      .map(([condition, count]) => ({ condition, count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      stats: {
        collections: collectionIds.length,
        copies: copies.length,
        uniqueGames: gameIds.size,
        platforms: platformIds.size,
        physicalCopies,
        digitalCopies,
        inventoryItems: items.length,
        systems,
        peripherals,
        toysToLife,
        estimatedValue,
        purchasePrice,
        valueDelta: estimatedValue - purchasePrice,
        conditionCounts,
        platformCounts
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
