import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAdmin, requireAuth } from "../auth.js";

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

type LabelTextRow = {
  labelText: string | null;
};

function normalizeAssetTagPrefix(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase();
}

function normalizeText(value: string | null | undefined) {
  if (typeof value === "undefined") return undefined;

  if (value === null) return null;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

async function ensureLabelTextColumn() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "AppSetting" ADD COLUMN IF NOT EXISTS "labelText" TEXT'
  );
}

async function getLabelText() {
  await ensureLabelTextColumn();

  const rows = await prisma.$queryRawUnsafe<LabelTextRow[]>(
    'SELECT "labelText" FROM "AppSetting" WHERE id = $1 LIMIT 1',
    "global"
  );

  return rows[0]?.labelText || "";
}

async function setLabelText(value: string | null) {
  await ensureLabelTextColumn();

  await prisma.$executeRawUnsafe(
    'UPDATE "AppSetting" SET "labelText" = $1 WHERE id = $2',
    value,
    "global"
  );
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
      appIconUrl: "/vgcs-icon.png",
      assetTagPrefix: "VGC"
    }
  });
}

function maskSecret(value: string | null | undefined) {
  if (!value) return null;

  if (value.length <= 8) return "••••••••";

  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

async function publicSettings(settings: Awaited<ReturnType<typeof getSettings>>) {
  const raw = settings as any;
  const labelText = await getLabelText();

  return {
    allowPublicSignup: settings.allowPublicSignup,
    branding: {
      appName: raw.appName || "VGC Shelf",
      pageTitle: raw.pageTitle || raw.appName || "VGC Shelf",
      appIconUrl: raw.appIconUrl || null,
      assetTagPrefix: raw.assetTagPrefix || "VGC",
      labelText
    },
    apiKeys: {
      igdbClientId: maskSecret(raw.igdbClientId),
      igdbClientSecret: maskSecret(raw.igdbClientSecret),
      twitchAccessToken: maskSecret(raw.twitchAccessToken),
      priceChartingApiKey: maskSecret(raw.priceChartingApiKey),
      rawgApiKey: maskSecret(raw.rawgApiKey),
      giantBombApiKey: maskSecret(raw.giantBombApiKey),
      mobyGamesApiKey: maskSecret(raw.mobyGamesApiKey),
      steamWebApiKey: maskSecret(raw.steamWebApiKey),
      customMetadataApiUrl: raw.customMetadataApiUrl || null,
      customMetadataApiKey: maskSecret(raw.customMetadataApiKey)
    }
  };
}

const apiKeySchema = z.object({
  igdbClientId: z.string().nullable().optional(),
  igdbClientSecret: z.string().nullable().optional(),
  twitchAccessToken: z.string().nullable().optional(),
  priceChartingApiKey: z.string().nullable().optional(),
  rawgApiKey: z.string().nullable().optional(),
  giantBombApiKey: z.string().nullable().optional(),
  mobyGamesApiKey: z.string().nullable().optional(),
  steamWebApiKey: z.string().nullable().optional(),
  customMetadataApiUrl: z.string().url().nullable().optional().or(z.literal("")),
  customMetadataApiKey: z.string().nullable().optional()
});

const brandingSchema = z.object({
  appName: z.string().min(1).max(80).optional(),
  pageTitle: z.string().min(1).max(120).optional(),
  appIconUrl: z.string().url().nullable().optional().or(z.literal("")),
  assetTagPrefix: z.string()
    .regex(/^[a-zA-Z0-9]{3}$/, "Asset tag prefix must be exactly 3 letters or numbers")
    .optional(),
  labelText: z.string().max(80).nullable().optional()
});

router.get("/settings", async (_req, res, next) => {
  try {
    const settings = await getSettings();

    res.json({
      settings: await publicSettings(settings)
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/settings", async (req, res, next) => {
  try {
    const body = z.object({
      allowPublicSignup: z.boolean().optional(),
      branding: brandingSchema.optional(),
      apiKeys: apiKeySchema.optional()
    }).parse(req.body);

    const updateData: Record<string, unknown> = {};

    if (typeof body.allowPublicSignup !== "undefined") {
      updateData.allowPublicSignup = body.allowPublicSignup;
    }

    if (body.branding) {
      if (typeof body.branding.appName !== "undefined") {
        updateData.appName = body.branding.appName.trim();
      }

      if (typeof body.branding.pageTitle !== "undefined") {
        updateData.pageTitle = body.branding.pageTitle.trim();
      }

      if (typeof body.branding.appIconUrl !== "undefined") {
        updateData.appIconUrl = normalizeText(body.branding.appIconUrl);
      }

      if (typeof body.branding.assetTagPrefix !== "undefined") {
        updateData.assetTagPrefix = normalizeAssetTagPrefix(
          body.branding.assetTagPrefix
        );
      }
    }

    if (body.apiKeys) {
      for (const [key, value] of Object.entries(body.apiKeys)) {
        updateData[key] = normalizeText(
          value as string | null | undefined
        );
      }
    }

    const settings = await prisma.appSetting.upsert({
      where: { id: "global" },
      update: updateData as any,
      create: {
        id: "global",
        allowPublicSignup: body.allowPublicSignup ?? true,
        appName: "VGC Shelf",
        pageTitle: "VGC Shelf",
        appIconUrl: "/vgcs-icon.png",
        assetTagPrefix: "VGC",
        ...updateData
      } as any
    });

    if (
      body.branding &&
      typeof body.branding.labelText !== "undefined"
    ) {
      await setLabelText(
        normalizeText(body.branding.labelText) ?? null
      );
    } else {
      await ensureLabelTextColumn();
    }

    res.json({
      settings: await publicSettings(settings)
    });
  } catch (err) {
    next(err);
  }
});

router.get("/users", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    res.json({ users });
  } catch (err) {
    next(err);
  }
});

router.post("/users", async (req, res, next) => {
  try {
    const body = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().optional(),
      role: z.nativeEnum(UserRole).default(UserRole.USER)
    }).parse(req.body);

    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash,
        name: body.name,
        role: body.role
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    res.status(201).json({ user });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({
        error: "Email already exists"
      });
    }

    next(err);
  }
});

router.patch("/users/:id", async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().nullable().optional(),
      role: z.nativeEnum(UserRole).optional(),
      password: z.string().min(8).optional()
    }).parse(req.body);

    const data: {
      name?: string | null;
      role?: UserRole;
      passwordHash?: string;
    } = {};

    if ("name" in body) {
      data.name = body.name;
    }

    if (body.role) {
      data.role = body.role;
    }

    if (body.password) {
      data.passwordHash = await bcrypt.hash(body.password, 12);
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.post("/users/:id/reset-password", async (req, res, next) => {
  try {
    const body = z.object({
      password: z.string().min(8)
    }).parse(req.body);

    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

router.delete("/users/:id", async (req, res, next) => {
  try {
    if (req.params.id === req.user!.id) {
      return res.status(400).json({
        error: "You cannot delete your own account while signed in"
      });
    }

    const target = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true }
    });

    if (!target) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    await prisma.user.delete({
      where: { id: req.params.id }
    });

    res.status(204).send();
  } catch (err: any) {
    if (err?.code === "P2003") {
      return res.status(409).json({
        error:
          "This user cannot be deleted because they are referenced by existing records. Remove or transfer their related records first."
      });
    }

    next(err);
  }
});

export default router;
