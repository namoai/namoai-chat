import { redis } from "@/lib/redis";

type RateLimitOptions = {
  identifier: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

/**
 * Upstash Redis 기반 간단한 슬라이딩 윈도우 레이트리미터
 */
const memoryStore = new Map<
  string,
  { count: number; expiresAt: number; timeout: NodeJS.Timeout }
>();

const incrementMemory = (key: string, ttlSeconds: number): number => {
  const existing = memoryStore.get(key);
  const now = Date.now();

  if (!existing || existing.expiresAt <= now) {
    if (existing?.timeout) {
      clearTimeout(existing.timeout);
    }
    const expiresAt = now + ttlSeconds * 1000;
    const timeout = setTimeout(() => memoryStore.delete(key), ttlSeconds * 1000);
    memoryStore.set(key, { count: 1, expiresAt, timeout });
    return 1;
  }

  existing.count += 1;
  return existing.count;
};

async function incrementKey(key: string, ttlSeconds: number): Promise<number> {
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, ttlSeconds);
      }
      return count;
    } catch (error) {
      console.error("[rateLimit] Failed to increment Redis key. Falling back to in-memory store.", error);
    }
  }

  return incrementMemory(key, ttlSeconds);
}

export async function rateLimit({
  identifier,
  limit,
  windowMs,
}: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = `ratelimit:${identifier}:${windowStart}`;
  const ttlSeconds = Math.ceil(windowMs / 1000);

  const count = await incrementKey(key, ttlSeconds);

  const success = count <= limit;
  const remaining = Math.max(0, limit - count);
  const reset = windowStart + windowMs;

  return { success, limit, remaining, reset };
}

export function buildRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.floor(result.reset / 1000).toString(),
  };
}

