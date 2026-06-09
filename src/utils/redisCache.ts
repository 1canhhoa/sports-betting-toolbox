import { CACHE_PREFIX } from "./cacheKeys.js";
import { getRedisClient } from "./redis.js";

const DEFAULT_TTL_SEC = Number(process.env.REDIS_CACHE_TTL_SEC ?? 3600);

type MemoryEntry = { value: string; expiresAt: number };

const memoryStore = new Map<string, MemoryEntry>();

export function isRedisConfigured(): boolean {
  if (process.env.REDIS_ENABLED === "false") return false;
  return Boolean(process.env.REDIS_URL?.trim() || process.env.REDIS_HOST?.trim());
}

function fullKey(key: string): string {
  return `${CACHE_PREFIX}${key}`;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redisKey = fullKey(key);

  if (isRedisConfigured()) {
    try {
      const raw = await getRedisClient().get(redisKey);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      // fall through to memory store
    }
  }

  const entry = memoryStore.get(redisKey);
  if (!entry || entry.expiresAt <= Date.now()) {
    memoryStore.delete(redisKey);
    return null;
  }
  return JSON.parse(entry.value) as T;
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSec = DEFAULT_TTL_SEC,
): Promise<void> {
  const redisKey = fullKey(key);
  const raw = JSON.stringify(value);

  if (isRedisConfigured()) {
    try {
      await getRedisClient().set(redisKey, raw, "EX", ttlSec);
      return;
    } catch {
      // fall through to memory store
    }
  }

  memoryStore.set(redisKey, {
    value: raw,
    expiresAt: Date.now() + ttlSec * 1000,
  });
}

export async function cacheDelete(key: string): Promise<void> {
  const redisKey = fullKey(key);
  memoryStore.delete(redisKey);

  if (!isRedisConfigured()) return;

  try {
    await getRedisClient().del(redisKey);
  } catch {
    // ignore delete failures when Redis is unavailable
  }
}

export async function cacheFlushNamespace(): Promise<number> {
  let removed = 0;
  memoryStore.clear();

  if (!isRedisConfigured()) return removed;

  try {
    const client = getRedisClient();
    const pattern = `${CACHE_PREFIX}*`;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        removed += await client.del(...keys);
      }
    } while (cursor !== "0");
  } catch {
    // ignore flush failures when Redis is unavailable
  }

  return removed;
}

export function clearMemoryCache(): void {
  memoryStore.clear();
}
