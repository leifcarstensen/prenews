import { Suspense } from "react";
import { getFeedItems, type MarketWithState } from "@/lib/queries";
import { formatProbability, formatResolvesIn } from "@prenews/shared";
import { MarketCard } from "@/components/market-card";
import { SkeletonFeed } from "@/components/skeleton-card";

export const revalidate = 60;

export const metadata = {
  title: "Most Likely — PreNews",
  description: "Prediction market headlines most likely to happen, ranked by probability and urgency.",
};

async function LikelyFeed() {
  let items: MarketWithState[];
  try {
    items = await getFeedItems("likely", 50);
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
          category={item.category}
          resolvesInText={formatResolvesIn(item.resolvesAt)}
          trustTier={item.trustTier}
          source={item.source}
          rank={item.rank}
        />
      ))}
    </div>
  );
}

export default function TomorrowPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text">Most Likely</h1>
        <p className="text-sm text-text-secondary mt-1">
          Headlines with the highest market-implied probability of happening soon.
        </p>
      </div>

      <Suspense fallback={<SkeletonFeed />}>
        <LikelyFeed />
      </Suspense>
    </div>
  );
}
