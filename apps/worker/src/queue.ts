import { Queue, Worker, type Job } from "bullmq";

function parseRedisConnection() {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  if (redisUrl.startsWith("http://") || redisUrl.startsWith("https://")) {
    throw new Error(
      "REDIS_URL is an HTTP endpoint. BullMQ requires Redis TCP using redis:// or rediss:// (Upstash REST URLs are not supported).",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(redisUrl);
  } catch {
    throw new Error("REDIS_URL is not a valid URL. Expected format: rediss://user:password@host:6379");
  }

  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error(
      `REDIS_URL protocol "${parsed.protocol}" is invalid. Use redis:// or rediss://.`,
    );
  }

  const port = parsed.port ? Number.parseInt(parsed.port, 10) : 6379;
  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`REDIS_URL port "${parsed.port}" is invalid.`);
  }

  if (!parsed.hostname) {
    throw new Error("REDIS_URL host is missing.");
  }

  const username = parsed.username ? decodeURIComponent(parsed.username) : undefined;
  const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;

  if (!password) {
    console.warn(
      "[queue] REDIS_URL has no password. If using Upstash, this is usually required.",
    );
  }

  console.log(
    `[queue] Redis target ${parsed.protocol}//${parsed.hostname}:${port} (user=${username ?? "default"})`,
  );

  return {
    host: parsed.hostname,
    port,
    username,
    password,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    // BullMQ/ioredis stability defaults.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    family: 0 as const,
    connectTimeout: 15000,
  };
}

const redisConnection = parseRedisConnection();

export const JOB_NAMES = {
  DISCOVERY: "discovery",
  PRICING: "pricing",
  ENRICHMENT: "enrichment",
  FEED_BUILD: "feed-build",
} as const;

export const jobQueue = new Queue("prenews-jobs", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export function createWorker(
  processor: (job: Job) => Promise<void>,
): Worker {
  return new Worker("prenews-jobs", processor, {
    connection: redisConnection,
    concurrency: 1,
  });
}
