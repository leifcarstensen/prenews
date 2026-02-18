import { NextRequest, NextResponse } from "next/server";
import { searchMarkets } from "@/lib/queries";
import { formatProbability, formatResolvesIn } from "@prenews/shared";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json(
      { error: "Query parameter 'q' must be at least 2 characters" },
      { status: 400 },
    );
  }

  const items = await searchMarkets(q.trim(), 20);

  const response = items.map((item) => ({
    market: {
      id: item.id,
      slug: item.slug,
      source: item.source,
      url: item.sourceUrl,
      headline: item.headline ?? item.titleRaw,
      category: item.category,
      resolves_at: item.resolvesAt?.toISOString() ?? null,
    },
    state: {
      p: item.p,
      trust_tier: item.trustTier,
    },
    display: {
      probability_text: formatProbability(item.p),
      resolves_in_text: formatResolvesIn(item.resolvesAt),
    },
  }));

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=120",
    },
  });
}
