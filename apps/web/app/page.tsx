import { Suspense } from "react";
import { getTopMarketsByVolume, getFeedItems, getSparklineData, type MarketWithState } from "@/lib/queries";
import { formatProbability, formatResolvesIn, formatDelta, computeDeltas } from "@prenews/shared";
import { MarketCard } from "@/components/market-card";
import { SkeletonFeed } from "@/components/skeleton-card";
import { formatUsdCompact } from "@/lib/format";
import Link from "next/link";
import { TrustBadge } from "@/components/trust-badge";

export const revalidate = 60;

export const metadata = {
  title: "PreNews — The news before it happens",
  description: "Prediction market intelligence: the highest-volume markets across politics, economics, crypto, sports, and world events.",
};

function HeroCard({ item }: { item: MarketWithState }) {
  const headline = item.headline ?? item.titleRaw;
  const probText = formatProbability(item.p);
  const resolvesText = formatResolvesIn(item.resolvesAt);

  return (
    <Link
      href={`/m/${item.slug}`}
      className="group block rounded-[10px] border border-border bg-card overflow-hidden transition-colors hover:bg-card-hover"
    >
      {item.articleImageUrl && (
        <img
          src={item.articleImageUrl}
          alt={headline}
          className="w-full h-48 sm:h-64 object-cover"
          loading="eager"
        />
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          {item.normalizedCategory && (
            <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
              {item.normalizedCategory}
            </span>
          )}
          <TrustBadge tier={item.trustTier} />
        </div>
        <h2 className="text-lg font-semibold leading-snug text-text sm:text-xl">
          {headline}
        </h2>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="text-3xl font-semibold tabular-nums text-text">
            {probText}
          </span>
          <span className="text-sm text-text-muted">{resolvesText}</span>
        </div>
        {item.articleMetaDescription && (
          <p className="mt-3 text-sm text-text-secondary line-clamp-2">
            {item.articleMetaDescription}
          </p>
        )}
      </div>
    </Link>
  );
}

async function HomeFeed() {
  let items: MarketWithState[];
  let movedItems: MarketWithState[];
  try {
    items = await getTopMarketsByVolume({ limit: 20 });
  } catch {
    items = [];
  }
  try {
    movedItems = await getFeedItems("moved", 6);
  } catch {
    movedItems = [];
  }

  // Batch-fetch sparkline data for all visible markets
  const allIds = [...items, ...movedItems].map((m) => m.id);
  let sparklines = new Map<string, number[]>();
  try {
    sparklines = await getSparklineData(allIds);
  } catch {}

  if (items.length === 0) {
    return (
      <div className="rounded-[10px] border border-border bg-card p-8 text-center text-sm text-text-muted">
        No markets available yet. Data will appear once ingestion runs.
      </div>
    );
  }

  const hero = items[0]!;
  const gridItems = items.slice(1, 7);
  const listItems = items.slice(7);

  return (
    <div className="space-y-8">
      {/* Hero: featured story of the day */}
      <HeroCard item={hero} />

      {/* 2-column grid of next 6 markets */}
      {gridItems.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {gridItems.map((item) => (
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
              imageUrl={item.articleImageUrl}
              sparkline={sparklines.get(item.id)}
            />
          ))}
        </div>
      )}

      {/* Tomorrow's Headlines sidebar */}
      {movedItems.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text uppercase tracking-wider">
              Tomorrow&apos;s Headlines
            </h2>
            <Link href="/moved" className="text-xs text-accent hover:text-accent-hover">
              View all &rarr;
            </Link>
          </div>
          <div className="space-y-2">
            {movedItems.map((item) => (
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
        </div>
      )}

      {/* Remaining list */}
      {listItems.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text uppercase tracking-wider mb-3">
            More Markets
          </h2>
          <div className="space-y-3">
            {listItems.map((item) => (
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
                imageUrl={item.articleImageUrl}
                sparkline={sparklines.get(item.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text">Front Page</h1>
        <p className="mt-1 text-sm text-text-secondary">
          The news before it happens — top markets by volume across all categories.
        </p>
      </div>

      <Suspense fallback={<SkeletonFeed />}>
        <HomeFeed />
      </Suspense>
    </div>
  );
}
