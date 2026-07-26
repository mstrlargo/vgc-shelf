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
      assetTagPrefix: "VGC",
      assetLabelWidth: 2.25,
      assetLabelHeight: 1.0,
      assetLabelShowQr: true,
      assetLabelShowLabelText: true,
      assetLabelShowAssetTag: true,
      assetLabelShowItemTitle: false,
      assetLabelShowCollectionName: false,
      assetLabelShowPlatform: false,
      assetLabelShowCollectionType: false,
      assetLabelShowOwnerName: true,
      assetLabelShowOwnerEmail: true,
      assetLabelShowBarcode: false
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
      assetLabelWidth: Number(raw.assetLabelWidth) || 2.25,
      assetLabelHeight: Number(raw.assetLabelHeight) || 1.0,
      assetLabelShowQr: raw.assetLabelShowQr ?? true,
      assetLabelShowLabelText: raw.assetLabelShowLabelText ?? true,
      assetLabelShowAssetTag: raw.assetLabelShowAssetTag ?? true,
      assetLabelShowItemTitle: raw.assetLabelShowItemTitle ?? false,
      assetLabelShowCollectionName: raw.assetLabelShowCollectionName ?? false,
      assetLabelShowPlatform: raw.assetLabelShowPlatform ?? false,
      assetLabelShowCollectionType: raw.assetLabelShowCollectionType ?? false,
      assetLabelShowOwnerName: raw.assetLabelShowOwnerName ?? true,
      assetLabelShowOwnerEmail: raw.assetLabelShowOwnerEmail ?? true,
      assetLabelShowBarcode: raw.assetLabelShowBarcode ?? false,
      labelText
    },
    smtp: {
      host: raw.smtpHost || null,
      port: raw.smtpPort || 587,
      secure: Boolean(raw.smtpSecure),
      user: raw.smtpUser || null,
      password: maskSecret(raw.smtpPass),
      from: raw.smtpFrom || null,
      configured: Boolean(raw.smtpHost && raw.smtpFrom)
    },
    lendingReminders: {
      enabled: raw.loanReminderEnabled ?? true,
      timing: raw.loanReminderTiming || "AFTER_DUE",
      days: raw.loanReminderDays ?? 0,
      repeatDays: raw.loanReminderRepeatDays ?? 1,
      subject: raw.loanReminderSubject || "Reminder: {{title}} is due {{dueDate}}",
      message: raw.loanReminderMessage || "Hello {{borrowerName}},\n\nThis is a reminder that {{title}} ({{assetTag}}) from {{collectionName}} is due {{dueDate}}.\n\nPlease arrange to return it.\n\nThank you."
    },
    apiKeys: {
      igdbClientId: maskSecret(raw.igdbClientId),
      igdbClientSecret: maskSecret(raw.igdbClientSecret),
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
  priceChartingApiKey: z.string().nullable().optional(),
  rawgApiKey: z.string().nullable().optional(),
  giantBombApiKey: z.string().nullable().optional(),
  mobyGamesApiKey: z.string().nullable().optional(),
  steamWebApiKey: z.string().nullable().optional(),
  customMetadataApiUrl: z.string().url().nullable().optional().or(z.literal("")),
  customMetadataApiKey: z.string().nullable().optional()
});

const smtpSchema = z.object({
  host: z.string().max(255).nullable().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  user: z.string().max(255).nullable().optional(),
  password: z.string().max(1024).nullable().optional(),
  from: z.string().max(255).nullable().optional()
});

const lendingReminderSchema = z.object({
  enabled: z.boolean().optional(),
  timing: z.enum(["BEFORE_DUE", "ON_DUE", "AFTER_DUE"]).optional(),
  days: z.number().int().min(0).max(365).optional(),
  repeatDays: z.number().int().min(0).max(365).optional(),
  subject: z.string().min(1).max(255).optional(),
  message: z.string().min(1).max(5000).optional()
});

const brandingSchema = z.object({
  appName: z.string().min(1).max(80).optional(),
  pageTitle: z.string().min(1).max(120).optional(),
  appIconUrl: z.string().url().nullable().optional().or(z.literal("")),
  assetTagPrefix: z.string()
    .regex(/^[a-zA-Z0-9]{3}$/, "Asset tag prefix must be exactly 3 letters or numbers")
    .optional(),
  labelText: z.string().max(80).nullable().optional(),
  assetLabelWidth: z.number().min(0.5).max(6).optional(),
  assetLabelHeight: z.number().min(0.5).max(6).optional(),
  assetLabelShowQr: z.boolean().optional(),
  assetLabelShowLabelText: z.boolean().optional(),
  assetLabelShowAssetTag: z.boolean().optional(),
  assetLabelShowItemTitle: z.boolean().optional(),
  assetLabelShowCollectionName: z.boolean().optional(),
  assetLabelShowPlatform: z.boolean().optional(),
  assetLabelShowCollectionType: z.boolean().optional(),
  assetLabelShowOwnerName: z.boolean().optional(),
  assetLabelShowOwnerEmail: z.boolean().optional(),
  assetLabelShowBarcode: z.boolean().optional()
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
      apiKeys: apiKeySchema.optional(),
      smtp: smtpSchema.optional(),
      lendingReminders: lendingReminderSchema.optional()
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

      if (typeof body.branding.assetLabelWidth !== "undefined") {
        updateData.assetLabelWidth = body.branding.assetLabelWidth;
      }

      if (typeof body.branding.assetLabelHeight !== "undefined") {
        updateData.assetLabelHeight = body.branding.assetLabelHeight;
      }

      for (const key of [
        "assetLabelShowQr",
        "assetLabelShowLabelText",
        "assetLabelShowAssetTag",
        "assetLabelShowItemTitle",
        "assetLabelShowCollectionName",
        "assetLabelShowPlatform",
        "assetLabelShowCollectionType",
        "assetLabelShowOwnerName",
        "assetLabelShowOwnerEmail",
        "assetLabelShowBarcode"
      ] as const) {
        if (typeof body.branding[key] !== "undefined") {
          updateData[key] = body.branding[key];
        }
      }
    }

    if (body.apiKeys) {
      for (const [key, value] of Object.entries(body.apiKeys)) {
        updateData[key] = normalizeText(
          value as string | null | undefined
        );
      }
    }

    if (body.smtp) {
      if (typeof body.smtp.host !== "undefined") updateData.smtpHost = normalizeText(body.smtp.host);
      if (typeof body.smtp.port !== "undefined") updateData.smtpPort = body.smtp.port;
      if (typeof body.smtp.secure !== "undefined") updateData.smtpSecure = body.smtp.secure;
      if (typeof body.smtp.user !== "undefined") updateData.smtpUser = normalizeText(body.smtp.user);
      if (typeof body.smtp.password !== "undefined") updateData.smtpPass = normalizeText(body.smtp.password);
      if (typeof body.smtp.from !== "undefined") updateData.smtpFrom = normalizeText(body.smtp.from);
    }

    if (body.lendingReminders) {
      if (typeof body.lendingReminders.enabled !== "undefined") updateData.loanReminderEnabled = body.lendingReminders.enabled;
      if (typeof body.lendingReminders.timing !== "undefined") updateData.loanReminderTiming = body.lendingReminders.timing;
      if (typeof body.lendingReminders.days !== "undefined") updateData.loanReminderDays = body.lendingReminders.days;
      if (typeof body.lendingReminders.repeatDays !== "undefined") updateData.loanReminderRepeatDays = body.lendingReminders.repeatDays;
      if (typeof body.lendingReminders.subject !== "undefined") updateData.loanReminderSubject = body.lendingReminders.subject.trim();
      if (typeof body.lendingReminders.message !== "undefined") updateData.loanReminderMessage = body.lendingReminders.message;
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
        assetLabelWidth: 2.25,
        assetLabelHeight: 1.0,
        assetLabelShowQr: true,
        assetLabelShowLabelText: true,
        assetLabelShowAssetTag: true,
        assetLabelShowItemTitle: false,
        assetLabelShowCollectionName: false,
        assetLabelShowPlatform: false,
        assetLabelShowCollectionType: false,
        assetLabelShowOwnerName: true,
        assetLabelShowOwnerEmail: true,
        assetLabelShowBarcode: false,
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
