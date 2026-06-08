import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "./db.js";
import { CollectionRole, UserRole } from "@prisma/client";

export type AuthUser = {
  id: string;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

export function signToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: "Missing bearer token" });

  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthUser;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { role: true }
  });

  if (!user || user.role !== UserRole.ADMIN) {
    return res.status(403).json({ error: "Admin access required" });
  }

  return next();
}

export async function requireCollectionRole(collectionId: string, userId: string, allowed: CollectionRole[]) {
  const membership = await prisma.collectionMember.findUnique({
    where: {
      userId_collectionId: {
        userId,
        collectionId
      }
    }
  });

  if (!membership || !allowed.includes(membership.role)) {
    return null;
  }

  return membership;
}
