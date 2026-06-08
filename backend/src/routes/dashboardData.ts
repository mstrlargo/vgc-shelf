import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../auth.js";

const router = Router();

router.use(requireAuth);

type Timeframe = "day" | "week" | "month" | "year" | "all";

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startOfHour(date: Date) {
  const next = new Date(date);
  next.setMinutes(0, 0, 0);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function formatLabel(date: Date, timeframe: Timeframe) {
  if (timeframe === "day") {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric"
    });
  }

  if (timeframe === "week" || timeframe === "month") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric"
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit"
  });
}

function makeBuckets(timeframe: Timeframe, earliestDate: Date | null) {
  const now = new Date();

  if (timeframe === "day") {
    const start = addHours(startOfHour(now), -23);
    return Array.from({ length: 24 }, (_, index) => {
      const startAt = addHours(start, index);
      return {
        startAt,
        endAt: addHours(startAt, 1),
        label: formatLabel(startAt, timeframe)
      };
    });
  }

  if (timeframe === "week") {
    const start = addDays(startOfDay(now), -6);
    return Array.from({ length: 7 }, (_, index) => {
      const startAt = addDays(start, index);
      return {
        startAt,
        endAt: addDays(startAt, 1),
        label: formatLabel(startAt, timeframe)
      };
    });
  }

  if (timeframe === "month") {
    const start = addDays(startOfDay(now), -29);
    return Array.from({ length: 30 }, (_, index) => {
      const startAt = addDays(start, index);
      return {
        startAt,
        endAt: addDays(startAt, 1),
        label: formatLabel(startAt, timeframe)
      };
    });
  }

  if (timeframe === "year") {
    const start = addMonths(startOfMonth(now), -11);
    return Array.from({ length: 12 }, (_, index) => {
      const startAt = addMonths(start, index);
      return {
        startAt,
        endAt: addMonths(startAt, 1),
        label: formatLabel(startAt, timeframe)
      };
    });
  }

  const fallbackStart = startOfMonth(now);
  const start = earliestDate ? startOfMonth(earliestDate) : fallbackStart;
  const buckets: Array<{ startAt: Date; endAt: Date; label: string }> = [];

  let cursor = start;
  let safety = 0;

  while (cursor <= now && safety < 240) {
    const startAt = new Date(cursor);
    const endAt = addMonths(startAt, 1);

    buckets.push({
      startAt,
      endAt,
      label: formatLabel(startAt, timeframe)
    });

    cursor = endAt;
    safety++;
  }

  return buckets.length > 0 ? buckets : [{
    startAt: fallbackStart,
    endAt: addMonths(fallbackStart, 1),
    label: formatLabel(fallbackStart, timeframe)
  }];
}

async function accessibleCollectionIds(userId: string) {
  const memberships = await prisma.collectionMember.findMany({
    where: { userId },
    select: { collectionId: true }
  });

  return memberships.map((membership) => membership.collectionId);
}

router.get("/", async (req, res, next) => {
  try {
    const timeframe = (String(req.query.timeframe || "year") as Timeframe);
    const safeTimeframe: Timeframe = ["day", "week", "month", "year", "all"].includes(timeframe) ? timeframe : "year";

    const collectionIds = await accessibleCollectionIds(req.user!.id);

    const [collections, gameCopies, collectionItems] = await Promise.all([
      prisma.collection.findMany({
        where: {
          id: { in: collectionIds }
        },
        orderBy: {
          name: "asc"
        }
      }),

      prisma.gameCopy.findMany({
        where: {
          collectionId: { in: collectionIds }
        },
        include: {
          game: {
            include: {
              platform: true
            }
          },
          parts: true,
          assetTag: {
            include: {
              loans: {
                where: {
                  status: "CHECKED_OUT"
                },
                take: 1
              }
            }
          }
        }
      }),

      prisma.collectionItem.findMany({
        where: {
          collectionId: { in: collectionIds }
        },
        include: {
          assetTag: {
            include: {
              loans: {
                where: {
                  status: "CHECKED_OUT"
                },
                take: 1
              }
            }
          }
        }
      })
    ]);

    const allRecords = [
      ...gameCopies.map((copy) => ({
        createdAt: copy.createdAt,
        pricePaid: toNumber(copy.purchasePrice),
        currentValue: toNumber(copy.estimatedValue)
      })),
      ...collectionItems.map((item) => ({
        createdAt: item.createdAt,
        pricePaid: toNumber(item.purchasePrice),
        currentValue: toNumber(item.estimatedValue)
      }))
    ];

    const earliestDate = allRecords.length > 0
      ? allRecords.reduce((earliest, record) => record.createdAt < earliest ? record.createdAt : earliest, allRecords[0].createdAt)
      : null;

    const buckets = makeBuckets(safeTimeframe, earliestDate);

    const timeline = buckets.map((bucket) => {
      const recordsThroughBucket = allRecords.filter((record) => record.createdAt < bucket.endAt);
      const currentValue = recordsThroughBucket.reduce((sum, record) => sum + record.currentValue, 0);
      const pricePaid = recordsThroughBucket.reduce((sum, record) => sum + record.pricePaid, 0);

      return {
        label: bucket.label,
        startAt: bucket.startAt.toISOString(),
        endAt: bucket.endAt.toISOString(),
        totalCurrentValue: currentValue,
        gainLoss: currentValue - pricePaid
      };
    });

    const summary = {
      collections: collections.length,
      games: gameCopies.length,
      platforms: new Set(gameCopies.map((copy) => copy.game.platform?.name).filter(Boolean)).size,
      systems: collectionItems.filter((item) => item.category === "SYSTEM").length,
      peripherals: collectionItems.filter((item) => item.category === "PERIPHERAL").length,
      toysToLife: collectionItems.filter((item) => item.category === "TOYS_TO_LIFE").length,
      physicalGames: gameCopies.filter((copy) => copy.format === "PHYSICAL").length,
      digitalGames: gameCopies.filter((copy) => copy.format === "DIGITAL").length,
      trackedParts: gameCopies.reduce((sum, copy) => sum + copy.parts.length, 0) + collectionItems.length,
      totalPricePaid: allRecords.reduce((sum, record) => sum + record.pricePaid, 0),
      totalCurrentValue: allRecords.reduce((sum, record) => sum + record.currentValue, 0),
      checkedOut: [
        ...gameCopies.filter((copy) => copy.assetTag?.loans?.length),
        ...collectionItems.filter((item) => item.assetTag?.loans?.length)
      ].length
    };

    const collectionBreakdown = collections
      .map((collection) => {
        const gameCount = gameCopies.filter((copy) => copy.collectionId === collection.id).length;
        const itemCount = collectionItems.filter((item) => item.collectionId === collection.id).length;

        return {
          label: collection.name,
          value: gameCount + itemCount
        };
      })
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

    const valueByCollection = collections
      .map((collection) => {
        const gameValue = gameCopies
          .filter((copy) => copy.collectionId === collection.id)
          .reduce((sum, copy) => sum + toNumber(copy.estimatedValue), 0);

        const itemValue = collectionItems
          .filter((item) => item.collectionId === collection.id)
          .reduce((sum, item) => sum + toNumber(item.estimatedValue), 0);

        return {
          label: collection.name,
          value: gameValue + itemValue
        };
      })
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

    res.json({
      timeframe: safeTimeframe,
      summary: {
        ...summary,
        gainLoss: summary.totalCurrentValue - summary.totalPricePaid
      },
      collectionBreakdown,
      valueByCollection,
      timeline
    });
  } catch (err) {
    next(err);
  }
});

export default router;
