import { Router } from "express";
import { prisma } from "../db.js";

const router = Router();

type LabelTextRow = {
  labelText: string | null;
};

async function ensureLabelTextColumn() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "labelText" TEXT'
  );
}

async function getLabelText() {
  try {
    await ensureLabelTextColumn();

    const rows = await prisma.$queryRawUnsafe<LabelTextRow[]>(
      'SELECT "labelText" FROM "AppSetting" WHERE id = $1 LIMIT 1',
      "global"
    );

    return rows[0]?.labelText || "";
  } catch {
    return "";
  }
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
      appIconUrl: null,
      assetTagPrefix: "VGC"
    }
  });
}

router.get("/", async (_req, res, next) => {
  try {
    const settings = await getSettings();
    const raw = settings as any;
    const labelText = await getLabelText();

    res.json({
      branding: {
        appName: raw.appName || "VGC Shelf",
        pageTitle: raw.pageTitle || raw.appName || "VGC Shelf",
        appIconUrl: raw.appIconUrl || null,
        assetTagPrefix: raw.assetTagPrefix || "VGC",
        labelText
      },
      settings: {
        allowPublicSignup: settings.allowPublicSignup
      },
      allowPublicSignup: settings.allowPublicSignup
    });
  } catch (err) {
    next(err);
  }
});

export default router;
