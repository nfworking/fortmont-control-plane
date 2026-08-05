import Redis from "ioredis";

let redisClient: Redis | null = null;

function getRedisUrl() {
  return process.env.REDIS_URL?.trim() ?? "";
}

export function isRedisConfigured() {
  return getRedisUrl().length > 0;
}

export function getRedisClient() {
  if (!isRedisConfigured()) {
    throw new Error("REDIS_URL is not configured");
  }

  if (!redisClient) {
    redisClient = new Redis(getRedisUrl(), {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      tls: getRedisUrl().startsWith("rediss://") ? {} : undefined,
    });
  }

  return redisClient;
}

export function createRedisSubscriber() {
  return getRedisClient().duplicate();
}

export function getRedisEndpoint() {
  const redisUrl = getRedisUrl();

  if (!redisUrl) {
    throw new Error("REDIS_URL is not configured");
  }

  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || (url.protocol === "rediss:" ? "6380" : "6379")),
    tls: url.protocol === "rediss:",
    db: Number((url.pathname || "/0").replace("/", "") || "0"),
  };
}
