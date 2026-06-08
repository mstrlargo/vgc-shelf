import { Redis } from "ioredis";

const redisUrl = process.env.REDIS_URL || "";

export const cache =
  redisUrl.length > 0
    ? new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false
      })
    : null;

if (cache) {
  cache.on("error", (err: Error) => {
    console.warn(
      "Redis unavailable; continuing without cache:",
      err.message
    );
  });
}

export async function getCachedJson<T>(
  key: string
): Promise<T | null> {
  if (!cache) {
    return null;
  }

  try {
    const raw = await cache.get(key);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCachedJson(
  key: string,
  value: unknown,
  seconds = 60
): Promise<void> {
  if (!cache) {
    return;
  }

  try {
    await cache.set(
      key,
      JSON.stringify(value),
      "EX",
      seconds
    );
  } catch {
    return;
  }
}

export async function deleteCachePattern(
  pattern: string
): Promise<void> {
  if (!cache) {
    return;
  }

  try {
    const keys = await cache.keys(pattern);

    if (keys.length > 0) {
      await cache.del(...keys);
    }
  } catch {
    return;
  }
}
