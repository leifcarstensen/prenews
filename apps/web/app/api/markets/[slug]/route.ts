import { NextRequest, NextResponse } from "next/server";
import { getMarketBySlug } from "@/lib/queries";
import { formatProbability, formatDelta, formatResolvesIn, generateMovementNote, computeDeltas } from "@prenews/shared";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const market = await getMarketBySlug(slug);

  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  const deltas = computeDeltas(market.p, market.snapshots);

  const response = {
    market: {
      id: market.id,
      slug: market.slug,
      source: market.source,
      url: market.sourceUrl,
      headline: market.headline ?? market.titleRaw,
      category: market.category,
      tags: market.tags,
      market_type: market.marketType,
      outcomes: market.outcomes,
      resolves_at: market.resolvesAt?.toISOString() ?? null,
      image_url: market.imageUrl,
    },
    state: {
      as_of: market.stateUpdatedAt.toISOString(),
      p: market.p,
      p_json: market.pJson,
      delta_1h: deltas.delta1h,
      delta_24h: deltas.delta24h,
      volume_24h: market.volume24h,
      liquidity: market.liquidity,
      spread: market.spread,
      trust_tier: market.trustTier,
    },
    display: {
      probability_text: formatProbability(market.p),
      delta_1h_text: formatDelta(deltas.delta1h),
      delta_24h_text: formatDelta(deltas.delta24h),
      resolves_in_text: formatResolvesIn(market.resolvesAt),
      movement_note: generateMovementNote({
        delta24h: deltas.delta24h,
        delta1h: deltas.delta1h,
        p: market.p,
        resolvesAt: market.resolvesAt,
      }),
    },
    snapshots: market.snapshots,
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
    },
  });
}
