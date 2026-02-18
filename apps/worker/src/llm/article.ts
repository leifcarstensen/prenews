import { getAzureClient, getDeployment } from "./client.js";
import { createHash } from "crypto";
import { z } from "zod";

const SITE_NAME = "PreNews";
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://prenews.news";

export const articleOutputSchema = z.object({
  headline: z.string().max(80),
  headline_short: z.string().max(50),
  meta_description: z.string().max(320),
  category: z.string(),
  tags: z.array(z.string()).max(5),
  body: z.string(),
  image_prompt: z.string().max(500),
});

export type ArticleOutput = z.infer<typeof articleOutputSchema>;

const BANNED_WORDS = [
  "shocking", "breaking", "bombshell", "explosive", "devastating",
  "sensational", "unbelievable", "insane", "crazy", "wild",
  "jaw-dropping", "mind-blowing", "game-changer",
];

const ARTICLE_PROMPT = `You are a premium editorial writer for ${SITE_NAME} (${SITE_URL}), a market-probability news platform that transforms prediction market data into news articles.

Given a prediction market title and data, generate a complete article. The article should:
- Be factual, grounded only in the market data provided
- Read like a premium, calm financial analysis (think Bloomberg or The Economist tone)
- Be SEO-optimized: naturally include relevant search keywords people would use to find news on this topic
- Reference ${SITE_NAME} as the source tracking this market
- Include the current probability and what it means
- Provide context on why this market matters and what resolution would look like
- Be 150-300 words (concise but substantive)

Output format (strict JSON):
{
  "headline": "max 80 chars, no question marks, no sensational terms, hooky but calm",
  "headline_short": "max 50 chars, for cards/social",
  "meta_description": "max 320 chars, SEO meta description mentioning ${SITE_NAME} and key probability",
  "category": "one of: politics, economics, technology, crypto, science, sports, entertainment, world, other",
  "tags": ["1-5 lowercase tags"],
  "body": "full article body in markdown (use ## for subheadings, **bold** for emphasis)",
  "image_prompt": "a detailed image generation prompt for a premium editorial header image, photographic style, no text overlay, moody and minimal, max 500 chars"
}

Rules:
- No question marks in headline
- No sensational/clickbait terms
- Do not invent facts beyond what market data shows
- Article must mention the probability percentage prominently
- Naturally mention "${SITE_NAME} tracking" or "${SITE_NAME} data shows" once in the body
- Meta description must be compelling for search results`;

export function hash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 64);
}

export async function generateArticle(input: {
  titleRaw: string;
  outcomes: string[];
  resolvesAt: string | null;
  source: string;
  probability: number;
  volume24h: number | null;
  liquidity: number | null;
  delta24h: number | null;
}): Promise<ArticleOutput> {
  const client = getAzureClient();
  const deployment = getDeployment();

  const userContent = JSON.stringify({
    title: input.titleRaw,
    outcomes: input.outcomes,
    resolves_at: input.resolvesAt,
    source: input.source,
    current_probability: `${Math.round(input.probability * 100)}%`,
    volume_24h: input.volume24h ? `$${Math.round(input.volume24h).toLocaleString()}` : "N/A",
    liquidity: input.liquidity ? `$${Math.round(input.liquidity).toLocaleString()}` : "N/A",
    delta_24h: input.delta24h != null ? `${input.delta24h > 0 ? "+" : ""}${Math.round(input.delta24h * 100)} pts` : "N/A",
  });

  const response = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: "system", content: ARTICLE_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0.3,
    max_tokens: 1500,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("Empty LLM response");

  const parsed = articleOutputSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    throw new Error(`Article validation failed: ${parsed.error.message}`);
  }

  return parsed.data;
}

export function validateArticle(output: ArticleOutput): boolean {
  if (output.headline.includes("?")) return false;
  if (output.headline.length > 80) return false;
  if (output.body.length < 100) return false;

  const lower = output.headline.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) return false;
  }

  return true;
}

export function fallbackArticle(titleRaw: string, probability: number): ArticleOutput {
  let headline = titleRaw
    .replace(/\?$/g, "")
    .replace(/^Will\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (headline.length > 80) {
    headline = headline.slice(0, 77) + "...";
  }

  const probText = `${Math.round(probability * 100)}%`;

  return {
    headline,
    headline_short: headline.length > 50 ? headline.slice(0, 47) + "..." : headline,
    meta_description: `${headline} — currently at ${probText} probability according to prediction market data tracked by ${SITE_NAME}.`,
    category: "other",
    tags: [],
    body: `Prediction markets currently place the probability of this outcome at **${probText}**.\n\n${SITE_NAME} tracks this market in real time. Visit the market page for live probability updates, historical charts, and source links.`,
    image_prompt: "abstract minimalist editorial illustration, muted tones, geometric shapes suggesting probability and data, dark background with subtle gradient",
  };
}

export const ARTICLE_PROMPT_HASH = hash(ARTICLE_PROMPT);
