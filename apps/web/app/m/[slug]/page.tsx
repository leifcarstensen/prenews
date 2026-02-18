import { notFound } from "next/navigation";
import { getMarketBySlug } from "@/lib/queries";
import {
  formatProbability,
  formatDelta,
  formatResolvesIn,
  generateMovementNote,
  computeDeltas,
} from "@prenews/shared";
import { TrustBadge } from "@/components/trust-badge";
import { DeltaBadge } from "@/components/delta-badge";
import { ProbabilityChart } from "@/components/probability-chart";
import { ArticleBody } from "@/components/article-body";
import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://prenews.news";
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "PreNews";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const market = await getMarketBySlug(slug);
  if (!market) return { title: "Not Found — PreNews" };

  const headline = market.headline ?? market.titleRaw;
  const description = market.articleMetaDescription
    ?? `${headline} — ${formatProbability(market.p)} probability. ${formatResolvesIn(market.resolvesAt)}. Tracked by ${SITE_NAME}.`;
  const canonicalUrl = `${SITE_URL}/m/${slug}`;
  const imageUrl = market.articleImageUrl ?? market.imageUrl;

  return {
    title: `${headline} — ${SITE_NAME}`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: headline,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: "article",
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: headline }],
      }),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title: headline,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
  };
}

export default async function MarketDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const market = await getMarketBySlug(slug);

  if (!market) notFound();

  const deltas = computeDeltas(market.p, market.snapshots);
  const headline = market.headline ?? market.titleRaw;
  const probText = formatProbability(market.p);
  const delta1hText = formatDelta(deltas.delta1h);
  const delta24hText = formatDelta(deltas.delta24h);
  const resolvesText = formatResolvesIn(market.resolvesAt);
  const movementNote = generateMovementNote({
    delta24h: deltas.delta24h,
    delta1h: deltas.delta1h,
    p: market.p,
    resolvesAt: market.resolvesAt,
  });
  const canonicalUrl = `${SITE_URL}/m/${slug}`;

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline,
    description: market.articleMetaDescription ?? movementNote,
    url: canonicalUrl,
    datePublished: market.stateUpdatedAt.toISOString(),
    dateModified: market.stateUpdatedAt.toISOString(),
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    ...(market.articleImageUrl && {
      image: market.articleImageUrl,
    }),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="space-y-6">
        {/* Header Image */}
        {market.articleImageUrl && (
          <div className="rounded-[10px] overflow-hidden border border-border">
            <img
              src={market.articleImageUrl}
              alt={headline}
              className="w-full h-48 object-cover sm:h-64"
              loading="eager"
            />
          </div>
        )}

        {/* Header */}
        <header>
          <div className="flex items-center gap-2 mb-2">
            {market.category && (
              <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                {market.category}
              </span>
            )}
            <TrustBadge tier={market.trustTier} />
          </div>

          <h1 className="text-xl font-semibold leading-tight text-text sm:text-2xl">
            {headline}
          </h1>

          <div className="mt-4 flex items-baseline gap-4">
            <span className="text-4xl font-semibold tabular-nums text-text">
              {probText}
            </span>

            <div className="flex items-center gap-2">
              {delta1hText && (
                <div className="text-xs text-text-muted">
                  <span className="block text-[10px] uppercase tracking-wider">1h</span>
                  <DeltaBadge text={delta1hText} />
                </div>
              )}
              {delta24hText && (
                <div className="text-xs text-text-muted">
                  <span className="block text-[10px] uppercase tracking-wider">24h</span>
                  <DeltaBadge text={delta24hText} />
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Chart */}
        <ProbabilityChart snapshots={market.snapshots} />

        {/* Article Body */}
        {market.articleBody ? (
          <ArticleBody content={market.articleBody} />
        ) : (
          <div className="rounded-[10px] border border-border bg-card p-4">
            <p className="text-sm text-text-secondary">{movementNote}</p>
          </div>
        )}

        {/* Market Data */}
        <div className="rounded-[10px] border border-border bg-card p-4 space-y-3">
          <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Market Data
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-text-muted text-xs uppercase tracking-wider block">Resolves</span>
              <span className="text-text">{resolvesText}</span>
            </div>
            <div>
              <span className="text-text-muted text-xs uppercase tracking-wider block">Source</span>
              <span className="text-text capitalize">{market.source}</span>
            </div>
            {market.volume24h != null && (
              <div>
                <span className="text-text-muted text-xs uppercase tracking-wider block">Volume 24h</span>
                <span className="text-text tabular-nums">
                  ${Math.round(market.volume24h).toLocaleString()}
                </span>
              </div>
            )}
            {market.liquidity != null && (
              <div>
                <span className="text-text-muted text-xs uppercase tracking-wider block">Liquidity</span>
                <span className="text-text tabular-nums">
                  ${Math.round(market.liquidity).toLocaleString()}
                </span>
              </div>
            )}
            {market.spread != null && (
              <div>
                <span className="text-text-muted text-xs uppercase tracking-wider block">Spread</span>
                <span className="text-text tabular-nums">
                  {(market.spread * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-border-subtle">
            <a
              href={market.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-accent hover:text-accent-hover transition-colors"
            >
              View on {market.source === "polymarket" ? "Polymarket" : "Kalshi"} &rarr;
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-text-muted text-center">
          Market-implied probabilities, not facts. Not financial advice. Thin markets can be manipulated.
        </p>
      </article>
    </>
  );
}
