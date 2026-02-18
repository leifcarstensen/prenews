import { NextRequest, NextResponse } from "next/server";
import { getFeedItems } from "@/lib/queries";
import { feedQuerySchema, formatProbability, formatDelta, formatResolvesIn, computeDeltas } from "@prenews/shared";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const parsed = feedQuerySchema.safeParse({
    limit: searchParams.get("limit") ?? 50,
    horizonDays: searchParams.get("horizon_days") ?? undefined,
    category: searchParams.get("category") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const items = await getFeedItems("likely", parsed.data.limit, parsed.data.category);

  const response = items.map((item) => ({
    market: {
      id: item.id,
      slug: item.slug,
      source: item.source,
      url: item.sourceUrl,
      headline: item.headline ?? item.titleRaw,
      category: item.category,
      resolves_at: item.resolvesAt?.toISOString() ?? null,
      image_url: item.imageUrl,
    },
    state: {
      as_of: item.stateUpdatedAt.toISOString(),
      p: item.p,
      volume_24h: item.volume24h,
      liquidity: item.liquidity,
      spread: item.spread,
      trust_tier: item.trustTier,
    },
    display: {
      probability_text: formatProbability(item.p),
      resolves_in_text: formatResolvesIn(item.resolvesAt),
    },
    rank: item.rank,
    score: item.score,
  }));

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
    },
  });
}
