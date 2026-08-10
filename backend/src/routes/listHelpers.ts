import { prisma } from "../db.js";

export type WishlistRow = {
  id: string;
  userId: string;
  title: string;
  platform: string | null;
  category: string;
  priority: string;
  targetPrice: string | null;
  notes: string | null;
  imageUrl: string | null;
  barcode: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SellListRow = {
  id: string;
  userId: string;
  sourceType: string;
  sourceId: string | null;
  title: string;
  platform: string | null;
  category: string;
  askingPrice: string | null;
  currentValue: string | null;
  status: string;
  notes: string | null;
  imageUrl: string | null;
  assetTag: string | null;
  collectionName: string | null;
  soldPrice: string | null;
  soldAt: Date | null;
  sourceRemovedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function id() {
  return crypto.randomUUID();
}

export function now() {
  return new Date();
}

export function toNumberOrNull(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export function toStringOrNull(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

export async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "WishlistItem" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "platform" TEXT,
      "category" TEXT NOT NULL DEFAULT 'GAME',
      "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
      "targetPrice" DECIMAL(10,2),
      "notes" TEXT,
      "imageUrl" TEXT,
      "barcode" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SellListItem" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
      "sourceId" TEXT,
      "title" TEXT NOT NULL,
      "platform" TEXT,
      "category" TEXT NOT NULL DEFAULT 'GAME',
      "askingPrice" DECIMAL(10,2),
      "currentValue" DECIMAL(10,2),
      "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
      "notes" TEXT,
      "imageUrl" TEXT,
      "assetTag" TEXT,
      "collectionName" TEXT,
      "soldPrice" DECIMAL(10,2),
      "soldAt" TIMESTAMP(3),
      "sourceRemovedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe('ALTER TABLE "SellListItem" ADD COLUMN IF NOT EXISTS "soldPrice" DECIMAL(10,2)');
  await prisma.$executeRawUnsafe('ALTER TABLE "SellListItem" ADD COLUMN IF NOT EXISTS "soldAt" TIMESTAMP(3)');
  await prisma.$executeRawUnsafe('ALTER TABLE "SellListItem" ADD COLUMN IF NOT EXISTS "sourceRemovedAt" TIMESTAMP(3)');
}

export function sortWishlist(rows: WishlistRow[], sort: string) {
  const priorityRank: Record<string, number> = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1
  };

  return [...rows].sort((a, b) => {
    if (sort === "name-desc") return b.title.localeCompare(a.title);
    if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sort === "priority") return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0) || a.title.localeCompare(b.title);
    if (sort === "target-price") return Number(a.targetPrice || 0) - Number(b.targetPrice || 0) || a.title.localeCompare(b.title);
    if (sort === "target-price-desc") return Number(b.targetPrice || 0) - Number(a.targetPrice || 0) || a.title.localeCompare(b.title);
    if (sort === "name") return a.title.localeCompare(b.title);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function sortSellList(rows: SellListRow[], sort: string) {
  return [...rows].sort((a, b) => {
    if (sort === "name-desc") return b.title.localeCompare(a.title);
    if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sort === "asking-price") return Number(a.askingPrice || 0) - Number(b.askingPrice || 0) || a.title.localeCompare(b.title);
    if (sort === "asking-price-desc") return Number(b.askingPrice || 0) - Number(a.askingPrice || 0) || a.title.localeCompare(b.title);
    if (sort === "current-value") return Number(a.currentValue || 0) - Number(b.currentValue || 0) || a.title.localeCompare(b.title);
    if (sort === "current-value-desc") return Number(b.currentValue || 0) - Number(a.currentValue || 0) || a.title.localeCompare(b.title);
    if (sort === "status") return a.status.localeCompare(b.status) || a.title.localeCompare(b.title);
    if (sort === "sold-date") return new Date(a.soldAt || 0).getTime() - new Date(b.soldAt || 0).getTime();
    if (sort === "sold-date-desc") return new Date(b.soldAt || 0).getTime() - new Date(a.soldAt || 0).getTime();
    if (sort === "sold-price") return Number(a.soldPrice || 0) - Number(b.soldPrice || 0) || a.title.localeCompare(b.title);
    if (sort === "sold-price-desc") return Number(b.soldPrice || 0) - Number(a.soldPrice || 0) || a.title.localeCompare(b.title);
    if (sort === "name") return a.title.localeCompare(b.title);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
