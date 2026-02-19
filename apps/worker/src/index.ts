import "./env.js";
import { createWorker, jobQueue, JOB_NAMES } from "./queue.js";
import { discoveryJob, pricingJob, enrichmentJob, feedBuildJob, imageGenJob } from "./jobs/index.js";
import type { Job } from "bullmq";

async function processJob(job: Job): Promise<void> {
  console.log(`Processing job: ${job.name}`);
  const startTime = Date.now();

  try {
    switch (job.name) {
      case JOB_NAMES.DISCOVERY:
        await discoveryJob();
        break;
      case JOB_NAMES.PRICING:
        await pricingJob();
        break;
      case JOB_NAMES.ENRICHMENT:
        await enrichmentJob();
        break;
      case JOB_NAMES.FEED_BUILD:
        await feedBuildJob();
        break;
      case JOB_NAMES.IMAGE_GEN:
        await imageGenJob();
        break;
      default:
        console.warn(`Unknown job: ${job.name}`);
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ job: job.name, status: "complete", duration_ms: duration }));
  } catch (err) {
    console.error(`Job ${job.name} failed:`, err);
    throw err; // Let BullMQ handle retries
  }
}

async function setupSchedules() {
  // Clear existing repeatable jobs
  const existing = await jobQueue.getRepeatableJobs();
  for (const job of existing) {
    await jobQueue.removeRepeatableByKey(job.key);
  }

  // Discovery: every 30 minutes
  await jobQueue.add(JOB_NAMES.DISCOVERY, {}, {
    repeat: { pattern: "*/30 * * * *" },
  });

  // Pricing: every 5 minutes
  await jobQueue.add(JOB_NAMES.PRICING, {}, {
    repeat: { pattern: "*/5 * * * *" },
  });

  // Enrichment: every 15 minutes
  await jobQueue.add(JOB_NAMES.ENRICHMENT, {}, {
    repeat: { pattern: "*/15 * * * *" },
  });

  // Feed build: every 5 minutes
  await jobQueue.add(JOB_NAMES.FEED_BUILD, {}, {
    repeat: { pattern: "*/5 * * * *" },
  });

  // Image generation: every hour (lower priority, runs after enrichment)
  await jobQueue.add(JOB_NAMES.IMAGE_GEN, {}, {
    repeat: { pattern: "0 * * * *" },
    priority: 10,
  });

  console.log("Job schedules configured");
}

async function main() {
  console.log("Starting PreNews worker...");

  const worker = createWorker(processJob);

  worker.on("completed", (job) => {
    console.log(`Job ${job.name} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.name} failed:`, err);
  });

  await setupSchedules();

  // Run initial discovery + pricing on startup
  await jobQueue.add(JOB_NAMES.DISCOVERY, {}, { priority: 1 });

  console.log("Worker running. Press Ctrl+C to exit.");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down...");
    await worker.close();
    await jobQueue.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});
