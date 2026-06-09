export const CACHE_PREFIX = process.env.REDIS_KEY_PREFIX?.trim() || "sportsbet:";

export function csvCacheKey(url: string): string {
  const slug = Buffer.from(url).toString("base64url").slice(0, 80);
  return `csv:${slug}`;
}

export function backtestCacheKey(oddsType: string, alpha: number, splits: number): string {
  return `backtest:dummy:${oddsType}:${alpha}:${splits}`;
}

export function valueBetsCacheKey(oddsType: string, alpha: number): string {
  return `valuebets:dummy:${oddsType}:${alpha}`;
}
