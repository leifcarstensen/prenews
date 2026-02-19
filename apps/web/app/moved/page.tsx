import { Suspense } from "react";
import { getFeedItems, getSparklineData, type MarketWithState } from "@/lib/queries";
import { formatProbability, formatResolvesIn } from "@prenews/shared";
import { MarketCard } from "@/components/market-card";
import { SkeletonFeed } from "@/components/skeleton-card";

export const revalidate = 60;

export const metadata = {
  title: "Tomorrow's Headlines — PreNews",
  description: "Markets with the largest probability repricing in the last 24 hours — the news before it happens.",
};

async function MovedFeed() {
  let items: MarketWithState[];
  try {
    items = await getFeedItems("moved", 50);
  } catch {
    items = [];
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[10px] border border-border bg-card p-8 text-center text-sm text-text-muted">
        No movement data available yet. Deltas require snapshot history.
      </div>
    );
  }

  let sparklines = new Map<string, number[]>();
  try {
    sparklines = await getSparklineData(items.map((m) => m.id));
  } catch {}

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
          showMovement={true}
          imageUrl={item.articleImageUrl}
          sparkline={sparklines.get(item.id)}
        />
      ))}
    </div>
  );
}

export default function MovedPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text">Tomorrow&apos;s Headlines</h1>
        <p className="text-sm text-text-secondary mt-1">
          Markets with the largest probability repricing in the last 24 hours — the news before it happens.
        </p>
      </div>

      <Suspense fallback={<SkeletonFeed />}>
        <MovedFeed />
      </Suspense>
    </div>
  );
}
