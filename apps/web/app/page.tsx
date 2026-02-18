import { Suspense } from "react";
import { getTopMarketsByVolume, type MarketWithState } from "@/lib/queries";
import { formatProbability, formatResolvesIn } from "@prenews/shared";
import { MarketCard } from "@/components/market-card";
import { SkeletonFeed } from "@/components/skeleton-card";
import { formatUsdCompact } from "@/lib/format";

export const revalidate = 60;

export const metadata = {
  title: "Top Markets by Volume — PreNews",
  description: "The 20 highest-volume prediction markets across categories, ranked by cumulative volume for markets resolving within a year.",
};

async function HomeFeed() {
  let items: MarketWithState[];
  try {
    items = await getTopMarketsByVolume({ limit: 20 });
  } catch {
    items = [];
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[10px] border border-border bg-card p-8 text-center text-sm text-text-muted">
        No markets available yet. Data will appear once ingestion runs.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <MarketCard
          key={item.id}
          slug={item.slug}
          headline={item.headline ?? item.titleRaw}
          probabilityText={formatProbability(item.p)}
          category={item.normalizedCategory ?? item.category}
          resolvesInText={formatResolvesIn(item.resolvesAt)}
          trustTier={item.trustTier}
          source={item.source}
          volumeText={formatUsdCompact(item.volumeTotal ?? item.volume24h)}
          rank={item.rank}
        />
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text">Front Page</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Top 20 markets ranked by total volume across all categories (resolving within 12 months).
        </p>
      </div>

      <Suspense fallback={<SkeletonFeed />}>
        <HomeFeed />
      </Suspense>
    </div>
  );
}
