import { Redis } from "@upstash/redis";

let redisClient: Redis | null = null;

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (url && token) {
  redisClient = new Redis({ url, token });
} else {
  console.warn(
    "[redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is not defined. Falling back to in-memory store."
  );
}

export const redis = redisClient;