import { Queue, Worker, type Job } from "bullmq";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
if (!/^rediss?:\/\//.test(redisUrl)) {
  throw new Error(
    "REDIS_URL must start with redis:// or rediss://. Upstash REST URLs (https://...) are not supported by BullMQ; use the Upstash Redis TCP URL instead.",
  );
}

const redisConnection = {
  url: redisUrl,
  // BullMQ requires null for robust command retry behavior.
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

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
