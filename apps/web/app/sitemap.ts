import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { CATEGORY_NAV } from "@/lib/categories";
import {
  pgTable,
  uuid,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://prenews.news";

const market = pgTable("market", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 256 }).notNull(),
  status: varchar("status", { length: 16 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "always",
      priority: 1.0,
    },
    ...CATEGORY_NAV.map((category) => ({
      url: `${SITE_URL}${category.href}`,
      lastModified: new Date(),
      changeFrequency: "always" as const,
      priority: 0.9,
    })),
    {
      url: `${SITE_URL}/tomorrow`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/moved`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.6,
    },
  ];

  // Add market detail pages
  try {
    const markets = await db
      .select({ slug: market.slug, updatedAt: market.updatedAt })
      .from(market)
      .where(eq(market.status, "active"))
      .limit(1000);

    for (const m of markets) {
      entries.push({
        url: `${SITE_URL}/m/${m.slug}`,
        lastModified: m.updatedAt,
        changeFrequency: "hourly",
        priority: 0.7,
      });
    }
  } catch {
    // DB not available at build time — return static entries only
  }

  return entries;
}
