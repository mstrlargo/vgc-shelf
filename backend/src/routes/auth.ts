import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAuth, signToken } from "../auth.js";

const router = Router();

async function getSettings() {
  return prisma.appSetting.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global", allowPublicSignup: true }
  });
}

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional()
});

router.post("/register", async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);

    const [settings, userCount] = await Promise.all([
      getSettings(),
      prisma.user.count()
    ]);

    const isFirstUser = userCount === 0;

    if (!settings.allowPublicSignup && !isFirstUser) {
      return res.status(403).json({
        error: "Public signup is disabled. Ask an administrator to create your account."
      });
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        passwordHash,
        name: body.name,
        role: isFirstUser ? UserRole.ADMIN : UserRole.USER
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    const token = signToken({ id: user.id, email: user.email });
    res.status(201).json({ token, user });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }

    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

router.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase() }
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);

    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken({ id: user.id, email: user.email });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
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

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const body = z.object({
      name: z.string().min(1).nullable().optional(),
      email: z.string().email().optional(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(8).optional()
    }).parse(req.body);

    const existing = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });

    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    const data: {
      name?: string | null;
      email?: string;
      passwordHash?: string;
    } = {};

    if ("name" in body) {
      data.name = body.name;
    }

    if (body.email && body.email.toLowerCase() !== existing.email) {
      data.email = body.email.toLowerCase();
    }

    if (body.newPassword) {
      if (!body.currentPassword) {
        return res.status(400).json({ error: "Current password is required to change password" });
      }

      const valid = await bcrypt.compare(body.currentPassword, existing.passwordHash);

      if (!valid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      data.passwordHash = await bcrypt.hash(body.newPassword, 12);
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    const token = signToken({ id: user.id, email: user.email });

    res.json({ user, token });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Email already exists" });
    }

    next(err);
  }
});

router.get("/settings", async (_req, res, next) => {
  try {
    const settings = await getSettings();
    const userCount = await prisma.user.count();

    res.json({
      settings: {
        allowPublicSignup: settings.allowPublicSignup,
        needsFirstAdmin: userCount === 0
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
