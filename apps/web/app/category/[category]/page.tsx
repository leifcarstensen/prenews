import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getTopMarketsByVolume, type MarketWithState } from "@/lib/queries";
import { formatProbability, formatResolvesIn } from "@prenews/shared";
import { MarketCard } from "@/components/market-card";
import { SkeletonFeed } from "@/components/skeleton-card";
import { formatUsdCompact } from "@/lib/format";
import { CATEGORY_NAV, getCategoryLabel, type NewsCategory } from "@/lib/categories";

export const revalidate = 60;

function isNewsCategory(value: string): value is NewsCategory {
  return CATEGORY_NAV.some((item) => item.key === value);
}

export function generateStaticParams() {
  return CATEGORY_NAV.map((item) => ({ category: item.key }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ category: string }> },
): Promise<Metadata> {
  const { category } = await params;
  if (!isNewsCategory(category)) {
    return {};
  }

  const label = getCategoryLabel(category);
  return {
    title: `${label} Markets by Volume — PreNews`,
    description: `Top ${label.toLowerCase()} prediction markets ranked by cumulative volume for markets resolving within a year.`,
  };
}

async function CategoryFeed({ category }: { category: NewsCategory }) {
  let items: MarketWithState[];
  try {
    items = await getTopMarketsByVolume({ category, limit: 20 });
  } catch {
    items = [];
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[10px] border border-border bg-card p-8 text-center text-sm text-text-muted">
        No markets available for this category yet.
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

export default async function CategoryPage(
  { params }: { params: Promise<{ category: string }> },
) {
  const { category } = await params;
  if (!isNewsCategory(category)) {
    notFound();
  }

  const label = getCategoryLabel(category);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-text">{label}</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Top 20 {label.toLowerCase()} markets ranked by total volume (resolving within 12 months).
        </p>
      </div>

      <Suspense fallback={<SkeletonFeed />}>
        <CategoryFeed category={category} />
      </Suspense>
    </div>
  );
}
