import { db, client } from "./connection.js";
import { market, marketState, marketSnapshot } from "./schema.js";
import { computeTsBucket } from "@prenews/shared";

async function main() {
  console.log("Seeding database...");

  const now = new Date();
  const tsBucket = computeTsBucket(now);

  const dummyMarkets = [
    {
      source: "polymarket" as const,
      sourceMarketId: "seed-poly-1",
      slug: "us-election-2028-winner",
      titleRaw: "Who will win the 2028 US Presidential Election?",
      headline: "2028 Presidential Election Winner",
      category: "politics",
      tags: ["politics", "us", "election"],
      marketType: "binary" as const,
      outcomes: ["Yes", "No"],
      status: "active" as const,
      resolvesAt: new Date("2028-11-05"),
      sourceUrl: "https://polymarket.com/event/example-1",
    },
    {
      source: "polymarket" as const,
      sourceMarketId: "seed-poly-2",
      slug: "fed-rate-cut-march-2026",
      titleRaw: "Will the Fed cut rates in March 2026?",
      headline: "Fed Rate Cut in March 2026",
      category: "economics",
      tags: ["economics", "fed", "rates"],
      marketType: "binary" as const,
      outcomes: ["Yes", "No"],
      status: "active" as const,
      resolvesAt: new Date("2026-03-31"),
      sourceUrl: "https://polymarket.com/event/example-2",
    },
    {
      source: "kalshi" as const,
      sourceMarketId: "seed-kalshi-1",
      slug: "bitcoin-above-100k-end-of-march",
      titleRaw: "Will Bitcoin be above $100,000 at the end of March 2026?",
      headline: "Bitcoin Above $100K End of March",
      category: "crypto",
      tags: ["crypto", "bitcoin"],
      marketType: "binary" as const,
      outcomes: ["Yes", "No"],
      status: "active" as const,
      resolvesAt: new Date("2026-03-31"),
      sourceUrl: "https://kalshi.com/event/example-1",
    },
    {
      source: "kalshi" as const,
      sourceMarketId: "seed-kalshi-2",
      slug: "next-supreme-court-retirement-2026",
      titleRaw: "Will a Supreme Court justice retire in 2026?",
      headline: "Supreme Court Retirement in 2026",
      category: "politics",
      tags: ["politics", "scotus"],
      marketType: "binary" as const,
      outcomes: ["Yes", "No"],
      status: "active" as const,
      resolvesAt: new Date("2026-12-31"),
      sourceUrl: "https://kalshi.com/event/example-2",
    },
    {
      source: "polymarket" as const,
      sourceMarketId: "seed-poly-3",
      slug: "ai-passes-turing-test-2026",
      titleRaw: "Will an AI system pass the Turing Test by end of 2026?",
      headline: "AI Passes Turing Test by 2026",
      category: "technology",
      tags: ["technology", "ai"],
      marketType: "binary" as const,
      outcomes: ["Yes", "No"],
      status: "active" as const,
      resolvesAt: new Date("2026-12-31"),
      sourceUrl: "https://polymarket.com/event/example-3",
    },
  ];

  const inserted = await db
    .insert(market)
    .values(dummyMarkets)
    .onConflictDoNothing()
    .returning();

  console.log(`Inserted ${inserted.length} markets`);

  // Insert states and snapshots for each inserted market
  for (const m of inserted) {
    const p = 0.3 + Math.random() * 0.5; // random prob between 0.3 and 0.8

    await db
      .insert(marketState)
      .values({
        marketId: m.id,
        p,
        volume24h: Math.floor(Math.random() * 500000),
        liquidity: Math.floor(Math.random() * 200000),
        spread: 0.01 + Math.random() * 0.05,
        trustTier: "medium",
      })
      .onConflictDoNothing();

    // Insert a few snapshots at different ts_buckets
    for (let i = 0; i < 5; i++) {
      const snapBucket = tsBucket - i * 300; // 5-min intervals going back
      const snapP = p + (Math.random() - 0.5) * 0.05; // slight variation
      await db
        .insert(marketSnapshot)
        .values({
          marketId: m.id,
          tsBucket: snapBucket,
          p: Math.max(0, Math.min(1, snapP)),
          volume24h: Math.floor(Math.random() * 500000),
        })
        .onConflictDoNothing();
    }
  }

  console.log("Seed complete.");
  await client.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
