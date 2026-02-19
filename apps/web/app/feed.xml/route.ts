import { getTopMarketsByVolume } from "@/lib/queries";
import { formatProbability, formatResolvesIn } from "@prenews/shared";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://prenews.news";
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "PreNews";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const items = await getTopMarketsByVolume({ limit: 50 });

  const feedItems = items.map((item) => {
    const headline = item.headline ?? item.titleRaw;
    const probText = formatProbability(item.p);
    const resolvesText = formatResolvesIn(item.resolvesAt);
    const url = `${SITE_URL}/m/${item.slug}`;
    const description = item.articleMetaDescription
      ?? `${headline} — ${probText} probability. ${resolvesText}. Tracked by ${SITE_NAME}.`;
    const pubDate = item.stateUpdatedAt?.toUTCString() ?? new Date().toUTCString();

    return `    <item>
      <title>${escapeXml(headline)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${pubDate}</pubDate>
      ${item.category ? `<category>${escapeXml(item.category)}</category>` : ""}
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)}</title>
    <link>${escapeXml(SITE_URL)}</link>
    <description>Prediction market intelligence — the news before it happens</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(SITE_URL)}/feed.xml" rel="self" type="application/rss+xml"/>
${feedItems.join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
    },
  });
}
