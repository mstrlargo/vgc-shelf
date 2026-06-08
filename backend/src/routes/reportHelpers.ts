import { prisma } from "../db.js";

export function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeTitle(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/\bthe\b/g, "")
    .replace(/\band\b/g, "&")
    .replace(/[^a-z0-9&+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeRegion(value?: string | null) {
  const raw = (value || "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    "us": "NTSC-U",
    "usa": "NTSC-U",
    "na": "NTSC-U",
    "north america": "NTSC-U",
    "ntsc": "NTSC",
    "ntsc-u": "NTSC-U",
    "jp": "NTSC-J",
    "japan": "NTSC-J",
    "ntsc-j": "NTSC-J",
    "eu": "PAL",
    "europe": "PAL",
    "uk": "PAL",
    "pal": "PAL"
  };
  return aliases[raw] || (value || "").trim().toUpperCase();
}

export function normalizePlatform(value?: string | null) {
  const raw = (value || "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    "nes": "Nintendo Entertainment System",
    "nintendo entertainment system": "Nintendo Entertainment System",
    "snes": "Super Nintendo",
    "super nintendo": "Super Nintendo",
    "super nintendo entertainment system": "Super Nintendo",
    "n64": "Nintendo 64",
    "nintendo 64": "Nintendo 64",
    "gamecube": "Nintendo GameCube",
    "nintendo gamecube": "Nintendo GameCube",
    "switch": "Nintendo Switch",
    "nintendo switch": "Nintendo Switch",
    "gb": "Game Boy",
    "game boy": "Game Boy",
    "gbc": "Game Boy Color",
    "game boy color": "Game Boy Color",
    "gba": "Game Boy Advance",
    "game boy advance": "Game Boy Advance",
    "ds": "Nintendo DS",
    "nintendo ds": "Nintendo DS",
    "3ds": "Nintendo 3DS",
    "nintendo 3ds": "Nintendo 3DS",
    "ps1": "PlayStation",
    "playstation": "PlayStation",
    "playstation 1": "PlayStation",
    "ps2": "PlayStation 2",
    "playstation 2": "PlayStation 2",
    "ps3": "PlayStation 3",
    "playstation 3": "PlayStation 3",
    "ps4": "PlayStation 4",
    "playstation 4": "PlayStation 4",
    "ps5": "PlayStation 5",
    "playstation 5": "PlayStation 5",
    "xbox": "Xbox",
    "xbox 360": "Xbox 360",
    "xbox one": "Xbox One",
    "xbox series x": "Xbox Series X/S",
    "xbox series s": "Xbox Series X/S",
    "pc": "PC",
    "windows": "PC",
    "steam": "PC"
  };

  if (!raw) return "Unknown";
  return aliases[raw] || (value || "Unknown").trim();
}

export function add(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) || 0) + value);
}

export function count(map: Map<string, number>, key: string) {
  add(map, key, 1);
}

export function rows(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

export async function collectionIdsForUser(userId: string) {
  const memberships = await prisma.collectionMember.findMany({
    where: { userId },
    select: { collectionId: true }
  });

  return memberships.map((m) => m.collectionId);
}

export async function loadData(userId: string) {
  const collectionIds = await collectionIdsForUser(userId);

  const [collections, gameCopies, collectionItems, assetTags] = await Promise.all([
    prisma.collection.findMany({
      where: { id: { in: collectionIds } },
      orderBy: { name: "asc" }
    }),
    prisma.gameCopy.findMany({
      where: { collectionId: { in: collectionIds } },
      include: {
        collection: true,
        game: { include: { platform: true } },
        parts: true,
        assetTag: {
          include: {
            loans: {
              where: { status: "CHECKED_OUT" },
              orderBy: { checkedOutAt: "desc" },
              take: 1
            }
          }
        }
      }
    }),
    prisma.collectionItem.findMany({
      where: { collectionId: { in: collectionIds } },
      include: {
        collection: true,
        assetTag: {
          include: {
            loans: {
              where: { status: "CHECKED_OUT" },
              orderBy: { checkedOutAt: "desc" },
              take: 1
            }
          }
        }
      }
    }),
    prisma.assetTag.findMany({
      where: {
        OR: [
          { gameCopy: { collectionId: { in: collectionIds } } },
          { collectionItem: { collectionId: { in: collectionIds } } }
        ]
      }
    })
  ]);

  return { collections, gameCopies, collectionItems, assetTags };
}

export function duplicateGroups(data: Awaited<ReturnType<typeof loadData>>) {
  const byBarcode = new Map<string, any[]>();
  const byGame = new Map<string, any[]>();
  const byItem = new Map<string, any[]>();

  for (const copy of data.gameCopies) {
    const platform = normalizePlatform(copy.game.platform?.name);
    const region = normalizeRegion(copy.region);
    const row = {
      id: copy.id,
      kind: "game",
      title: copy.game.title,
      platform,
      collectionName: copy.collection.name,
      collectionId: copy.collectionId,
      barcode: copy.barcode || "",
      assetTag: copy.assetTag?.tag || null,
      status: copy.assetTag?.loans?.[0] ? `Checked out to ${copy.assetTag.loans[0].borrowerName}` : "In collection"
    };

    if (copy.barcode) {
      const key = copy.barcode.trim();
      if (!byBarcode.has(key)) byBarcode.set(key, []);
      byBarcode.get(key)!.push(row);
    }

    const key = `${normalizeTitle(copy.game.title)}|${platform.toLowerCase()}|${region}`;
    if (!byGame.has(key)) byGame.set(key, []);
    byGame.get(key)!.push(row);
  }

  for (const item of data.collectionItems) {
    const platform = normalizePlatform(item.platform);
    const row = {
      id: item.id,
      kind: item.category.toLowerCase(),
      title: item.name,
      platform,
      collectionName: item.collection.name,
      collectionId: item.collectionId,
      barcode: item.barcode || "",
      serialNumber: item.serialNumber || "",
      assetTag: item.assetTag?.tag || null,
      status: item.assetTag?.loans?.[0] ? `Checked out to ${item.assetTag.loans[0].borrowerName}` : "In collection"
    };

    if (item.barcode) {
      const key = item.barcode.trim();
      if (!byBarcode.has(key)) byBarcode.set(key, []);
      byBarcode.get(key)!.push(row);
    }

    const key = `${item.category}|${normalizeTitle(item.name)}|${platform.toLowerCase()}`;
    if (!byItem.has(key)) byItem.set(key, []);
    byItem.get(key)!.push(row);
  }

  const groups = (map: Map<string, any[]>, type: string) =>
    Array.from(map.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => ({ type, key, count: items.length, items }));

  return [
    ...groups(byBarcode, "barcode"),
    ...groups(byGame, "game"),
    ...groups(byItem, "item")
  ].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function metadataReport(data: Awaited<ReturnType<typeof loadData>>) {
  const suggestions: any[] = [];
  const platformAliases = new Map<string, Set<string>>();

  let missingBarcodes = 0;
  let missingImages = 0;
  let missingPlatforms = 0;
  let missingRegions = 0;
  let missingValues = 0;

  for (const copy of data.gameCopies) {
    const rawPlatform = copy.game.platform?.name || "";
    const normalizedPlatform = normalizePlatform(rawPlatform);
    const warnings: string[] = [];

    if (!rawPlatform) { missingPlatforms++; warnings.push("Missing platform"); }
    if (!copy.barcode) { missingBarcodes++; warnings.push("Missing barcode"); }
    if (!copy.region) { missingRegions++; warnings.push("Missing region"); }
    if (!copy.game.coverUrl) { missingImages++; warnings.push("Missing cover image"); }
    if (!copy.estimatedValue) { missingValues++; warnings.push("Missing current value"); }

    if (rawPlatform) {
      const key = normalizedPlatform.toLowerCase();
      if (!platformAliases.has(key)) platformAliases.set(key, new Set());
      platformAliases.get(key)!.add(rawPlatform);
    }

    if (rawPlatform && rawPlatform !== normalizedPlatform) warnings.push(`Platform can normalize to ${normalizedPlatform}`);
    if (copy.region && copy.region !== normalizeRegion(copy.region)) warnings.push(`Region can normalize to ${normalizeRegion(copy.region)}`);

    if (warnings.length) {
      suggestions.push({
        kind: "game",
        id: copy.id,
        title: copy.game.title,
        collectionName: copy.collection.name,
        rawPlatform,
        normalizedPlatform,
        rawRegion: copy.region || "",
        normalizedRegion: normalizeRegion(copy.region),
        normalizedTitle: normalizeTitle(copy.game.title),
        warnings
      });
    }
  }

  for (const item of data.collectionItems) {
    const rawPlatform = item.platform || "";
    const normalizedPlatform = normalizePlatform(rawPlatform);
    const warnings: string[] = [];

    if (!item.barcode) { missingBarcodes++; warnings.push("Missing barcode"); }
    if (!item.imageUrl) { missingImages++; warnings.push("Missing image"); }
    if (!item.estimatedValue) { missingValues++; warnings.push("Missing current value"); }

    if (rawPlatform) {
      const key = normalizedPlatform.toLowerCase();
      if (!platformAliases.has(key)) platformAliases.set(key, new Set());
      platformAliases.get(key)!.add(rawPlatform);
    }

    if (rawPlatform && rawPlatform !== normalizedPlatform) warnings.push(`Platform can normalize to ${normalizedPlatform}`);

    if (warnings.length) {
      suggestions.push({
        kind: item.category.toLowerCase(),
        id: item.id,
        title: item.name,
        collectionName: item.collection.name,
        rawPlatform,
        normalizedPlatform,
        normalizedTitle: normalizeTitle(item.name),
        warnings
      });
    }
  }

  const platformAliasGroups = Array.from(platformAliases.entries())
    .map(([normalized, variants]) => ({
      normalized,
      variants: Array.from(variants).sort()
    }))
    .filter((g) => g.variants.length > 1)
    .sort((a, b) => b.variants.length - a.variants.length);

  return {
    summary: {
      missingBarcodes,
      missingImages,
      missingPlatforms,
      missingRegions,
      missingValues,
      suggestions: suggestions.length,
      platformAliasGroups: platformAliasGroups.length
    },
    platformAliasGroups,
    suggestions: suggestions.slice(0, 200)
  };
}

export function analyticsFor(data: Awaited<ReturnType<typeof loadData>>) {
  const valueByPlatform = new Map<string, number>();
  const spendByPlatform = new Map<string, number>();
  const countByPlatform = new Map<string, number>();
  const valueByCollection = new Map<string, number>();
  const spendByCollection = new Map<string, number>();
  const countByCollection = new Map<string, number>();
  const conditionBreakdown = new Map<string, number>();
  const topValueItems: any[] = [];
  const loanedItems: any[] = [];

  let totalPricePaid = 0;
  let totalCurrentValue = 0;
  let games = 0;
  let systems = 0;
  let peripherals = 0;
  let toysToLife = 0;
  let physicalGames = 0;
  let digitalGames = 0;
  let trackedParts = 0;

  for (const copy of data.gameCopies) {
    games++;
    if (copy.format === "DIGITAL") digitalGames++;
    else physicalGames++;

    const platform = normalizePlatform(copy.game.platform?.name);
    const pricePaid = toNumber(copy.purchasePrice);
    const currentValue = toNumber(copy.estimatedValue);

    totalPricePaid += pricePaid;
    totalCurrentValue += currentValue;

    add(valueByPlatform, platform, currentValue);
    add(spendByPlatform, platform, pricePaid);
    count(countByPlatform, platform);
    add(valueByCollection, copy.collection.name, currentValue);
    add(spendByCollection, copy.collection.name, pricePaid);
    count(countByCollection, copy.collection.name);

    for (const part of copy.parts || []) {
      trackedParts++;
      count(conditionBreakdown, `${part.type}: ${part.condition}`);
    }

    if (currentValue > 0) {
      topValueItems.push({
        kind: "game",
        title: copy.game.title,
        platform,
        collectionName: copy.collection.name,
        pricePaid,
        currentValue,
        gainLoss: currentValue - pricePaid,
        url: `/collections/${copy.collectionId}`
      });
    }

    const loan = copy.assetTag?.loans?.[0];
    if (loan) {
      loanedItems.push({
        kind: "game",
        title: copy.game.title,
        assetTag: copy.assetTag?.tag || null,
        borrowerName: loan.borrowerName,
        dueAt: loan.dueAt,
        collectionName: copy.collection.name,
        url: `/collections/${copy.collectionId}`
      });
    }
  }

  for (const item of data.collectionItems) {
    if (item.category === "SYSTEM") systems++;
    if (item.category === "PERIPHERAL") peripherals++;
    if (item.category === "TOYS_TO_LIFE") toysToLife++;

    const platform = normalizePlatform(item.platform);
    const pricePaid = toNumber(item.purchasePrice);
    const currentValue = toNumber(item.estimatedValue);

    totalPricePaid += pricePaid;
    totalCurrentValue += currentValue;

    add(valueByPlatform, platform, currentValue);
    add(spendByPlatform, platform, pricePaid);
    count(countByPlatform, platform);
    add(valueByCollection, item.collection.name, currentValue);
    add(spendByCollection, item.collection.name, pricePaid);
    count(countByCollection, item.collection.name);
    count(conditionBreakdown, `${item.category}: ${item.condition}`);

    if (currentValue > 0) {
      topValueItems.push({
        kind: item.category.toLowerCase(),
        title: item.name,
        platform,
        collectionName: item.collection.name,
        pricePaid,
        currentValue,
        gainLoss: currentValue - pricePaid,
        url: `/collections/${item.collectionId}`
      });
    }

    const loan = item.assetTag?.loans?.[0];
    if (loan) {
      loanedItems.push({
        kind: item.category.toLowerCase(),
        title: item.name,
        assetTag: item.assetTag?.tag || null,
        borrowerName: loan.borrowerName,
        dueAt: loan.dueAt,
        collectionName: item.collection.name,
        url: `/collections/${item.collectionId}`
      });
    }
  }

  const dups = duplicateGroups(data);
  const metadata = metadataReport(data);
  topValueItems.sort((a, b) => b.currentValue - a.currentValue);

  return {
    summary: {
      collections: data.collections.length,
      games,
      systems,
      peripherals,
      toysToLife,
      physicalGames,
      digitalGames,
      trackedParts,
      assetTags: data.assetTags.length,
      loanedItems: loanedItems.length,
      totalPricePaid,
      totalCurrentValue,
      gainLoss: totalCurrentValue - totalPricePaid,
      duplicateGroups: dups.length,
      metadataWarnings: metadata.summary.suggestions
    },
    valueByPlatform: rows(valueByPlatform),
    spendByPlatform: rows(spendByPlatform),
    countByPlatform: rows(countByPlatform),
    valueByCollection: rows(valueByCollection),
    spendByCollection: rows(spendByCollection),
    countByCollection: rows(countByCollection),
    conditionBreakdown: rows(conditionBreakdown),
    topValueItems: topValueItems.slice(0, 25),
    loanedItems,
    duplicateGroups: dups,
    metadata
  };
}

