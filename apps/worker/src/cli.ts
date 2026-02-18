import "./env.js";
import { discoveryJob, pricingJob, enrichmentJob, feedBuildJob } from "./jobs/index.js";
import { client } from "./db/connection.js";

const JOBS: Record<string, () => Promise<unknown>> = {
  discovery: discoveryJob,
  pricing: pricingJob,
  enrich: () => enrichmentJob(),
  feeds: feedBuildJob,
};

async function main() {
  const jobName = process.argv[2];
  const limitArg = process.argv[3];

  if (!jobName || !JOBS[jobName]) {
    console.error("Usage: pnpm --filter worker run run <job> [limit]");
    console.error(`Available jobs: ${Object.keys(JOBS).join(", ")}`);
    console.error("Example: pnpm --filter worker run run enrich 1");
    process.exit(1);
  }

  const parsedLimit = limitArg === undefined ? undefined : Number.parseInt(limitArg, 10);
  if (parsedLimit !== undefined && (!Number.isFinite(parsedLimit) || parsedLimit < 1)) {
    console.error("limit must be a positive integer");
    process.exit(1);
  }

  console.log(`Running job: ${jobName}`);
  const startTime = Date.now();

  try {
    let result: unknown;
    if (jobName === "enrich" && parsedLimit !== undefined) {
      result = await enrichmentJob(parsedLimit);
    } else {
      result = await JOBS[jobName]!();
    }
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ job: jobName, status: "complete", duration_ms: duration, result }));
  } catch (err) {
    console.error(`Job ${jobName} failed:`, err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
