import { Router } from "express";
import { z } from "zod";
import { CollectionRole, CollectionType } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAdmin, requireAuth, requireCollectionRole } from "../auth.js";
import { conditionOrDefault, decimalOrUndefined, filenameSafe, parseCsv, stringOrUndefined, toCsv } from "./backupCsv.js";

const router = Router();

router.use(requireAuth);

router.get("/collections/:id/export.csv", async (req, res, next) => {
  try {
    const membership = await requireCollectionRole(req.params.id, req.user!.id, [CollectionRole.OWNER]);

    if (!membership) {
      return res.status(403).json({ error: "Only collection owners can export this collection" });
    }

    const collection = await prisma.collection.findUnique({
      where: { id: req.params.id },
      include: {
        copies: {
          include: {
            game: {
              include: {
                platform: true
              }
            }
          },
          orderBy: {
            createdAt: "asc"
          }
        },
        items: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    const rows: Record<string, unknown>[] = [
      ...collection.copies.map((copy) => ({
        recordType: "GAME",
        title: copy.game.title,
        platform: copy.game.platform?.name || "",
        format: copy.format,
        barcode: copy.barcode || "",
        region: copy.region || "",
        edition: copy.edition || "",
        condition: "",
        maker: "",
        modelNumber: "",
        serialNumber: "",
        pricePaid: copy.purchasePrice?.toString() || "",
        currentValue: copy.estimatedValue?.toString() || "",
        imageUrl: copy.game.coverUrl || "",
        notes: copy.notes || copy.game.description || ""
      })),
      ...collection.items.map((item) => ({
        recordType: item.category,
        title: item.name,
        platform: item.platform || "",
        format: "",
        barcode: item.barcode || "",
        region: "",
        edition: "",
        condition: item.condition,
        maker: item.maker || "",
        modelNumber: item.modelNumber || "",
        serialNumber: item.serialNumber || "",
        pricePaid: item.purchasePrice?.toString() || "",
        currentValue: item.estimatedValue?.toString() || "",
        imageUrl: item.imageUrl || "",
        notes: item.notes || ""
      }))
    ];

    const csv = toCsv(rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filenameSafe(collection.name)}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.post("/collections/:id/import.csv", async (req, res, next) => {
  try {
    const membership = await requireCollectionRole(req.params.id, req.user!.id, [CollectionRole.OWNER]);

    if (!membership) {
      return res.status(403).json({ error: "Only collection owners can import into this collection" });
    }

    const body = z.object({
      csv: z.string().min(1),
      mode: z.enum(["append", "replace"]).default("append")
    }).parse(req.body);

    const collection = await prisma.collection.findUnique({
      where: {
        id: req.params.id
      },
      select: {
        id: true,
        type: true
      }
    });

    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }

    const records = parseCsv(body.csv);
    let imported = 0;

    await prisma.$transaction(async (tx) => {
      if (body.mode === "replace") {
        await tx.gameCopy.deleteMany({
          where: {
            collectionId: collection.id
          }
        });

        await tx.collectionItem.deleteMany({
          where: {
            collectionId: collection.id
          }
        });
      }

      for (const record of records) {
        const title = stringOrUndefined(record.title);

        if (!title) continue;

        if (collection.type === CollectionType.GAMES) {
          let platformId: string | undefined;
          const platformName = stringOrUndefined(record.platform);

          if (platformName) {
            const platform = await tx.platform.upsert({
              where: {
                name: platformName
              },
              update: {},
              create: {
                name: platformName
              }
            });

            platformId = platform.id;
          }

          const game = await tx.game.create({
            data: {
              title,
              description: stringOrUndefined(record.notes),
              coverUrl: stringOrUndefined(record.imageUrl),
              platformId
            }
          });

          await tx.gameCopy.create({
            data: {
              collectionId: collection.id,
              gameId: game.id,
              format: record.format === "DIGITAL" ? "DIGITAL" : "PHYSICAL",
              barcode: stringOrUndefined(record.barcode),
              region: stringOrUndefined(record.region),
              edition: stringOrUndefined(record.edition),
              purchasePrice: decimalOrUndefined(record.pricePaid),
              estimatedValue: decimalOrUndefined(record.currentValue),
              notes: stringOrUndefined(record.notes)
            }
          });

          imported++;
          continue;
        }

        const category =
          collection.type === CollectionType.SYSTEMS
            ? "SYSTEM"
            : collection.type === CollectionType.PERIPHERALS
              ? "PERIPHERAL"
              : "TOYS_TO_LIFE";

        await tx.collectionItem.create({
          data: {
            collectionId: collection.id,
            category,
            name: title,
            maker: stringOrUndefined(record.maker),
            platform: stringOrUndefined(record.platform),
            modelNumber: stringOrUndefined(record.modelNumber),
            serialNumber: stringOrUndefined(record.serialNumber),
            barcode: stringOrUndefined(record.barcode),
            condition: conditionOrDefault(record.condition),
            purchasePrice: decimalOrUndefined(record.pricePaid),
            estimatedValue: decimalOrUndefined(record.currentValue),
            imageUrl: stringOrUndefined(record.imageUrl),
            notes: stringOrUndefined(record.notes)
          }
        });

        imported++;
      }
    });

    res.json({
      imported,
      mode: body.mode
    });
  } catch (err) {
    next(err);
  }
});

const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get("/export.json", async (_req, res, next) => {
  try {
    const [
      users,
      appSettings,
      collections,
      collectionMembers,
      platforms,
      games,
      gameCopies,
      gameParts,
      collectionItems,
      assetTags,
      loans
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.appSetting.findMany(),
      prisma.collection.findMany(),
      prisma.collectionMember.findMany(),
      prisma.platform.findMany(),
      prisma.game.findMany(),
      prisma.gameCopy.findMany(),
      prisma.gamePart.findMany(),
      prisma.collectionItem.findMany(),
      prisma.assetTag.findMany(),
      prisma.loan.findMany()
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      version: 1,
      data: {
        users,
        appSettings,
        collections,
        collectionMembers,
        platforms,
        games,
        gameCopies,
        gameParts,
        collectionItems,
        assetTags,
        loans
      }
    };

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="vgc-shelf-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(backup);
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/import.json", async (req, res, next) => {
  try {
    const body = z.object({
      backup: z.any(),
      confirmReplace: z.literal(true)
    }).parse(req.body);

    const data = body.backup?.data;

    if (!data) {
      return res.status(400).json({ error: "Invalid backup file" });
    }

    await prisma.$transaction(async (tx) => {
      await tx.loan.deleteMany();
      await tx.assetTag.deleteMany();
      await tx.gamePart.deleteMany();
      await tx.gameCopy.deleteMany();
      await tx.collectionItem.deleteMany();
      await tx.collectionMember.deleteMany();
      await tx.game.deleteMany();
      await tx.platform.deleteMany();
      await tx.collection.deleteMany();
      await tx.appSetting.deleteMany();
      await tx.user.deleteMany();

      if (Array.isArray(data.users) && data.users.length > 0) {
        await tx.user.createMany({
          data: data.users
        });
      }

      if (Array.isArray(data.appSettings) && data.appSettings.length > 0) {
        await tx.appSetting.createMany({
          data: data.appSettings
        });
      }

      if (Array.isArray(data.collections) && data.collections.length > 0) {
        await tx.collection.createMany({
          data: data.collections
        });
      }

      if (Array.isArray(data.collectionMembers) && data.collectionMembers.length > 0) {
        await tx.collectionMember.createMany({
          data: data.collectionMembers
        });
      }

      if (Array.isArray(data.platforms) && data.platforms.length > 0) {
        await tx.platform.createMany({
          data: data.platforms
        });
      }

      if (Array.isArray(data.games) && data.games.length > 0) {
        await tx.game.createMany({
          data: data.games
        });
      }

      if (Array.isArray(data.gameCopies) && data.gameCopies.length > 0) {
        await tx.gameCopy.createMany({
          data: data.gameCopies
        });
      }

      if (Array.isArray(data.gameParts) && data.gameParts.length > 0) {
        await tx.gamePart.createMany({
          data: data.gameParts
        });
      }

      if (Array.isArray(data.collectionItems) && data.collectionItems.length > 0) {
        await tx.collectionItem.createMany({
          data: data.collectionItems
        });
      }

      if (Array.isArray(data.assetTags) && data.assetTags.length > 0) {
        await tx.assetTag.createMany({
          data: data.assetTags
        });
      }

      if (Array.isArray(data.loans) && data.loans.length > 0) {
        await tx.loan.createMany({
          data: data.loans
        });
      }
    }, {
      timeout: 60000
    });

    res.json({
      ok: true
    });
  } catch (err) {
    next(err);
  }
});

router.use("/admin", adminRouter);

export default router;
