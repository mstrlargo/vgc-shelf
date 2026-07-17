import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { prisma } from "../db.js";

const router = Router();

router.use(requireAuth);

type MetadataResult = {
  provider: string;
  externalId: string;
  title: string;
  description?: string | null;
  releaseYear?: number | null;
  coverUrl?: string | null;
  platformName?: string | null;
  sourceUrl?: string | null;
  barcode?: string | null;
};

function asYear(value: unknown): number | null {
  if (!value) return null;

  if (typeof value === "number") {
    if (value > 1000000000) return new Date(value * 1000).getUTCFullYear();
    if (value > 1900 && value < 2200) return value;
  }

  if (typeof value === "string") {
    const year = Number(value.slice(0, 4));
    if (!Number.isNaN(year) && year > 1900 && year < 2200) return year;
  }

  return null;
}

function stripHtml(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || null;
}

function uniqueResults(results: MetadataResult[]) {
  const seen = new Set<string>();
  const output: MetadataResult[] = [];

  for (const result of results) {
    const key = `${result.provider}:${result.externalId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(result);
  }

  return output;
}

async function searchRawg(query: string, apiKey?: string | null, limit = 10): Promise<MetadataResult[]> {
  if (!apiKey) return [];

  const url = new URL("https://api.rawg.io/api/games");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("search", query);
  url.searchParams.set("page_size", String(limit));

  const res = await fetch(url);
  if (!res.ok) throw new Error(`RAWG search failed: ${res.status}`);

  const data = await res.json() as any;

  return (data.results || []).map((game: any) => ({
    provider: "RAWG",
    externalId: String(game.id),
    title: game.name,
    description: null,
    releaseYear: asYear(game.released),
    coverUrl: game.background_image || null,
    platformName: game.platforms?.[0]?.platform?.name || null,
    sourceUrl: game.slug ? `https://rawg.io/games/${game.slug}` : null
  })).filter((item: MetadataResult) => item.title);
}

type IgdbTokenCache = {
  clientId: string;
  accessToken: string;
  expiresAt: number;
};

let igdbTokenCache: IgdbTokenCache | null = null;

async function getIgdbAccessToken(clientId: string, clientSecret?: string | null) {
  if (!clientSecret) return null;

  const now = Date.now();

  if (
    igdbTokenCache &&
    igdbTokenCache.clientId === clientId &&
    igdbTokenCache.expiresAt > now + 60_000
  ) {
    return igdbTokenCache.accessToken;
  }

  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "client_credentials");

  const res = await fetch(url, { method: "POST" });

  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(`IGDB token request failed: ${res.status}${message ? ` ${message}` : ""}`);
  }

  const data = await res.json() as { access_token?: string; expires_in?: number };

  if (!data.access_token) {
    throw new Error("IGDB token request failed: missing access_token");
  }

  igdbTokenCache = {
    clientId,
    accessToken: data.access_token,
    expiresAt: now + Math.max(60, data.expires_in || 3600) * 1000
  };

  return data.access_token;
}

async function searchIgdb(
  query: string,
  clientId?: string | null,
  clientSecret?: string | null,
  limit = 10
): Promise<MetadataResult[]> {
  if (!clientId) return [];

  const accessToken = await getIgdbAccessToken(clientId, clientSecret);

  if (!accessToken) return [];

  const body = `
search "${query.replace(/"/g, '\"')}";
fields name,summary,first_release_date,cover.url,platforms.name,url;
limit ${limit};
`;

  const res = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "text/plain"
    },
    body
  });

  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(`IGDB search failed: ${res.status}${message ? ` ${message}` : ""}`);
  }

  const data = await res.json() as any[];

  return data.map((game: any) => {
    let coverUrl = game.cover?.url || null;

    if (coverUrl && coverUrl.startsWith("//")) coverUrl = `https:${coverUrl}`;
    if (coverUrl) coverUrl = coverUrl.replace("t_thumb", "t_cover_big");

    return {
      provider: "IGDB",
      externalId: String(game.id),
      title: game.name,
      description: game.summary || null,
      releaseYear: asYear(game.first_release_date),
      coverUrl,
      platformName: game.platforms?.[0]?.name || null,
      sourceUrl: game.url || null
    };
  }).filter((item: MetadataResult) => item.title);
}

async function searchGiantBomb(query: string, apiKey?: string | null, limit = 10): Promise<MetadataResult[]> {
  if (!apiKey) return [];

  const url = new URL("https://www.giantbomb.com/api/search/");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("query", query);
  url.searchParams.set("resources", "game");
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, {
    headers: { "User-Agent": "VGC-Shelf/1.0" }
  });

  if (!res.ok) throw new Error(`GiantBomb search failed: ${res.status}`);

  const data = await res.json() as any;

  return (data.results || []).map((game: any) => ({
    provider: "GiantBomb",
    externalId: String(game.id || game.guid),
    title: game.name,
    description: stripHtml(game.deck || game.description),
    releaseYear: asYear(game.original_release_date || game.expected_release_year),
    coverUrl: game.image?.medium_url || game.image?.small_url || null,
    platformName: game.platforms?.[0]?.name || null,
    sourceUrl: game.site_detail_url || null
  })).filter((item: MetadataResult) => item.title);
}

async function searchMobyGames(query: string, apiKey?: string | null, limit = 10): Promise<MetadataResult[]> {
  if (!apiKey) return [];

  const url = new URL("https://api.mobygames.com/v1/games");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("title", query);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url);
  if (!res.ok) throw new Error(`MobyGames search failed: ${res.status}`);

  const data = await res.json() as any;
  const games = data.games || data.results || [];

  return games.map((game: any) => ({
    provider: "MobyGames",
    externalId: String(game.game_id || game.id),
    title: game.title || game.name,
    description: stripHtml(game.description),
    releaseYear: asYear(game.sample_cover?.year || game.release_date || game.year),
    coverUrl: game.sample_cover?.image || game.cover?.image || null,
    platformName: game.platforms?.[0]?.platform_name || game.platforms?.[0]?.name || null,
    sourceUrl: game.moby_url || game.url || null
  })).filter((item: MetadataResult) => item.title);
}

async function searchSteam(query: string, limit = 10): Promise<MetadataResult[]> {
  const url = new URL("https://store.steampowered.com/api/storesearch/");
  url.searchParams.set("term", query);
  url.searchParams.set("cc", "us");
  url.searchParams.set("l", "en");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Steam search failed: ${res.status}`);

  const data = await res.json() as any;

  return (data.items || []).slice(0, limit).map((game: any) => ({
    provider: "Steam",
    externalId: String(game.id),
    title: game.name,
    description: null,
    releaseYear: null,
    coverUrl: game.tiny_image || null,
    platformName: "PC",
    sourceUrl: `https://store.steampowered.com/app/${game.id}`
  })).filter((item: MetadataResult) => item.title);
}

async function searchCustom(query: string, apiUrl?: string | null, apiKey?: string | null, limit = 10): Promise<MetadataResult[]> {
  if (!apiUrl) return [];

  const url = new URL(apiUrl);
  url.searchParams.set("q", query);

  const headers: Record<string, string> = { Accept: "application/json" };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["X-API-Key"] = apiKey;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Custom metadata search failed: ${res.status}`);

  const data = await res.json() as any;
  const items = Array.isArray(data) ? data : data.results || data.games || [];

  return items.slice(0, limit).map((game: any) => ({
    provider: "Custom",
    externalId: String(game.id || game.externalId || game.slug || game.title || game.name),
    title: game.title || game.name,
    description: game.description || game.summary || null,
    releaseYear: asYear(game.releaseYear || game.released || game.releaseDate),
    coverUrl: game.coverUrl || game.cover || game.image || null,
    platformName: game.platformName || game.platform || null,
    sourceUrl: game.sourceUrl || game.url || null,
    barcode: game.barcode || game.upc || game.ean || null
  })).filter((item: MetadataResult) => item.title);
}

async function getSettings() {
  return prisma.appSetting.upsert({
    where: { id: "global" },
    update: {},
    create: { id: "global", allowPublicSignup: true }
  });
}

router.get("/search", async (req, res, next) => {
  try {
    const query = z.string().min(2).parse(req.query.q);
    const provider = z.enum(["all", "rawg", "igdb", "giantbomb", "mobygames", "steam", "custom"])
      .default("all")
      .parse(req.query.provider || "all");
    const expanded = req.query.expanded === "true" || req.query.expanded === "1";
    const providerLimit = expanded ? 40 : 10;
    const totalLimit = expanded ? 160 : 30;

    const settings = await getSettings();
    const errors: Array<{ provider: string; error: string }> = [];
    const tasks: Array<Promise<MetadataResult[]>> = [];

    function addTask(name: string, task: Promise<MetadataResult[]>) {
      tasks.push(task.catch((err) => {
        errors.push({
          provider: name,
          error: err instanceof Error ? err.message : "Unknown error"
        });

        return [];
      }));
    }

    if (provider === "all" || provider === "rawg") addTask("RAWG", searchRawg(query, settings.rawgApiKey, providerLimit));
    if (provider === "all" || provider === "igdb") {
      addTask("IGDB", searchIgdb(
        query,
        settings.igdbClientId,
        settings.igdbClientSecret,
        providerLimit
      ));
    }
    if (provider === "all" || provider === "giantbomb") addTask("GiantBomb", searchGiantBomb(query, settings.giantBombApiKey, providerLimit));
    if (provider === "all" || provider === "mobygames") addTask("MobyGames", searchMobyGames(query, settings.mobyGamesApiKey, providerLimit));
    if (provider === "all" || provider === "steam") addTask("Steam", searchSteam(query, providerLimit));
    if (provider === "all" || provider === "custom") addTask("Custom", searchCustom(query, settings.customMetadataApiUrl, settings.customMetadataApiKey, providerLimit));

    const settled = await Promise.all(tasks);
    const results = uniqueResults(settled.flat()).slice(0, totalLimit);

    res.json({ results, errors });
  } catch (err) {
    next(err);
  }
});

router.get("/barcode", async (req, res, next) => {
  try {
    const code = z.string().min(4).parse(req.query.code).replace(/[^0-9A-Za-z-]/g, "");
    const settings = await getSettings();
    const errors: Array<{ provider: string; error: string }> = [];
    const tasks: Array<Promise<MetadataResult[]>> = [];

    function addTask(name: string, task: Promise<MetadataResult[]>) {
      tasks.push(task.catch((err) => {
        errors.push({
          provider: name,
          error: err instanceof Error ? err.message : "Unknown error"
        });

        return [];
      }));
    }

    const existingCopies = await prisma.gameCopy.findMany({
      where: { barcode: code },
      include: { game: { include: { platform: true } } },
      take: 10
    });

    const existingResults: MetadataResult[] = existingCopies.map((copy) => ({
      provider: "VGC Shelf",
      externalId: copy.id,
      title: copy.game.title,
      description: copy.game.description,
      releaseYear: copy.game.releaseYear,
      coverUrl: copy.game.coverUrl,
      platformName: copy.game.platform?.name || null,
      sourceUrl: null,
      barcode: code
    }));

    addTask("Custom", searchCustom(code, settings.customMetadataApiUrl, settings.customMetadataApiKey));
    addTask("RAWG", searchRawg(code, settings.rawgApiKey));
    addTask("Steam", searchSteam(code));

    const settled = await Promise.all(tasks);
    const results = uniqueResults([...existingResults, ...settled.flat()]).slice(0, 20);

    res.json({ barcode: code, results, errors });
  } catch (err) {
    next(err);
  }
});

export default router;
