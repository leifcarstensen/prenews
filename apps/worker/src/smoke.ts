import "./env.js";
import { discoveryJob, pricingJob, enrichmentJob, feedBuildJob } from "./jobs/index.js";
import { client } from "./db/connection.js";

/**
 * Smoke test: runs a minimal pipeline in dev.
 * discovery -> pricing -> enrich -> feeds
 */
async function main() {
  console.log("=== PreNews Smoke Test ===\n");

  try {
    console.log("1. Running discovery...");
    const discoveryResult = await discoveryJob();
    console.log("   Discovery:", discoveryResult);

    console.log("\n2. Running pricing...");
    const pricingResult = await pricingJob();
    console.log("   Pricing:", pricingResult);

    console.log("\n3. Running enrichment...");
    const enrichResult = await enrichmentJob();
    console.log("   Enrichment:", enrichResult);

    console.log("\n4. Building feeds...");
    const feedResult = await feedBuildJob();
    console.log("   Feeds:", feedResult);

    console.log("\n=== Smoke test complete ===");
  } catch (err) {
    console.error("Smoke test failed:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
