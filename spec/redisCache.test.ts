import { afterEach, describe, expect, it } from "vitest";
import { backtestCacheKey, csvCacheKey } from "../src/platform/cache/keys.js";
import {
  cacheDelete,
  cacheGet,
  cacheSet,
  clearMemoryCache,
} from "../src/platform/cache/store.js";

describe("cacheKeys", () => {
  it("builds stable csv keys", () => {
    expect(csvCacheKey("https://example.com/a.csv")).toMatch(/^csv:/);
    expect(csvCacheKey("https://example.com/a.csv")).toBe(csvCacheKey("https://example.com/a.csv"));
  });

  it("builds backtest keys", () => {
    expect(backtestCacheKey("williamhill", 0.03, 2)).toBe("backtest:dummy:williamhill:0.03:2");
  });
});

describe("redisCache memory fallback", () => {
  afterEach(() => {
    clearMemoryCache();
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
  });

  it("stores and retrieves values without Redis", async () => {
    await cacheSet("test:key", { rows: 3 }, 60);
    const value = await cacheGet<{ rows: number }>("test:key");
    expect(value?.rows).toBe(3);
  });

  it("deletes cached values", async () => {
    await cacheSet("test:delete", [1, 2], 60);
    await cacheDelete("test:delete");
    expect(await cacheGet("test:delete")).toBeNull();
  });
});
