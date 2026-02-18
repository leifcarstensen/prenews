export type NewsCategory =
  | "politics"
  | "sports"
  | "crypto"
  | "economics"
  | "world"
  | "events";

export interface CategoryNavItem {
  key: NewsCategory;
  label: string;
  href: string;
}

export const CATEGORY_NAV: CategoryNavItem[] = [
  { key: "politics", label: "Politics", href: "/category/politics" },
  { key: "sports", label: "Sports", href: "/category/sports" },
  { key: "crypto", label: "Crypto", href: "/category/crypto" },
  { key: "economics", label: "Economics", href: "/category/economics" },
  { key: "world", label: "World", href: "/category/world" },
  { key: "events", label: "Events", href: "/category/events" },
];

const SPORTS_KEYWORDS = [
  "nfl",
  "nba",
  "mlb",
  "nhl",
  "soccer",
  "football",
  "basketball",
  "baseball",
  "olympic",
  "world cup",
  "super bowl",
];

const CRYPTO_KEYWORDS = [
  "crypto",
  "bitcoin",
  "btc",
  "ethereum",
  "eth",
  "solana",
  "doge",
  "ripple",
  "xrp",
];

const POLITICS_KEYWORDS = [
  "election",
  "president",
  "senate",
  "congress",
  "governor",
  "democrat",
  "republican",
  "scotus",
  "supreme court",
  "white house",
  "trump",
  "biden",
];

const ECONOMICS_KEYWORDS = [
  "fed",
  "inflation",
  "cpi",
  "gdp",
  "recession",
  "rates",
  "rate cut",
  "unemployment",
  "treasury",
  "revenue",
  "deficit",
];

const WORLD_KEYWORDS = [
  "ukraine",
  "russia",
  "china",
  "taiwan",
  "israel",
  "iran",
  "nato",
  "europe",
  "eu",
  "united nations",
];

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

export function inferNewsCategory(input: {
  category: string | null;
  titleRaw: string;
  slug: string;
  tags: string[] | null | undefined;
}): NewsCategory {
  const declared = (input.category || "").trim().toLowerCase();

  if (declared.includes("politic")) return "politics";
  if (declared.includes("sport")) return "sports";
  if (declared.includes("crypto")) return "crypto";
  if (declared.includes("economic") || declared.includes("finance")) return "economics";
  if (
    declared.includes("world")
    || declared.includes("international")
    || declared.includes("geopolit")
  ) return "world";
  if (declared && declared !== "uncategorized" && declared !== "general") return "events";

  const haystack = [
    input.titleRaw,
    input.slug,
    ...(input.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  if (includesAny(haystack, SPORTS_KEYWORDS)) return "sports";
  if (includesAny(haystack, CRYPTO_KEYWORDS)) return "crypto";
  if (includesAny(haystack, POLITICS_KEYWORDS)) return "politics";
  if (includesAny(haystack, ECONOMICS_KEYWORDS)) return "economics";
  if (includesAny(haystack, WORLD_KEYWORDS)) return "world";

  return "events";
}

export function getCategoryLabel(category: NewsCategory): string {
  return CATEGORY_NAV.find((item) => item.key === category)?.label ?? "Events";
}
