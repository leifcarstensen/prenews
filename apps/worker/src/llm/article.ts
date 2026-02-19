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

/** Returns probability-adaptive framing instructions for the LLM. */
function getProbabilityFraming(p: number): string {
  const pct = p * 100;
  if (pct >= 80) {
    return `The probability is high (${Math.round(pct)}%). Use a declarative, confident tone. Frame as "X is on track to..." or "Markets strongly expect...". Convey near-certainty while noting remaining uncertainty.`;
  }
  if (pct <= 20) {
    return `The probability is low (${Math.round(pct)}%). Use a contra-narrative framing. Frame as "Against expectations, traders now price..." or "Markets see only a ${Math.round(pct)}% chance...". Explore why markets are skeptical.`;
  }
  return `The probability is near the middle (${Math.round(pct)}%). Use an analytical, balanced tone. Frame as "Markets are split on..." or "The outcome remains uncertain at ${Math.round(pct)}%...". Explore arguments on both sides.`;
}

/** Returns trust-tier context for the LLM. */
function getTrustContext(trustTier: string): string {
  switch (trustTier) {
    case "high":
      return "This market has HIGH trust (strong liquidity, tight spread, significant volume). The probability signal is reliable.";
    case "medium":
      return "This market has MEDIUM trust (moderate liquidity and volume). The probability is a reasonable signal but interpret with some caution.";
    default:
      return "This market has LOW trust (thin liquidity, wide spread, or low volume). Interpret the probability cautiously — thin markets can be manipulated.";
  }
}

const ARTICLE_PROMPT = `You are a premium editorial writer for ${SITE_NAME} (${SITE_URL}), a market-probability news platform that transforms prediction market data into news articles.

Given a prediction market title and data, generate a complete article. The article should:
- Be factual, grounded only in the market data provided
- Read like a premium, calm financial analysis (think Bloomberg or The Economist tone)
- Be SEO-optimized: naturally include relevant search keywords people would use to find news on this topic
- Reference ${SITE_NAME} as the source tracking this market
- Include the current probability and what it means
- Provide context on why this market matters and what resolution would look like
- Be 150-300 words (concise but substantive)

PROBABILITY-ADAPTIVE FRAMING:
Adjust your tone based on the probability level provided in the framing instructions below the market data.

TRUST CONTEXT:
Use the trust tier context to add appropriate hedging language. High-trust markets can be discussed with more confidence; low-trust markets should include caveats about thin liquidity.

RESOLUTION CRITERIA:
If resolution rules are provided, use them to explain exactly how this market resolves. This prevents hallucination and grounds the article factually.

MULTI-OUTCOME MARKETS:
If the market has more than 2 outcomes, present the data as a probability distribution. Focus the article on the leading outcome and its nearest competitor. Use language like "Traders assign X% probability to A, with B at Y%."

Output format (strict JSON):
{
  "headline": "max 80 chars, no question marks, no sensational terms, hooky but calm",
  "headline_short": "max 50 chars, for cards/social",
  "meta_description": "max 320 chars, SEO meta description mentioning ${SITE_NAME} and key probability",
  "category": "one of: politics, economics, technology, crypto, science, sports, entertainment, world, other",
  "tags": ["1-5 lowercase tags"],
  "body": "full article body in markdown (use ## for subheadings, **bold** for emphasis)",
  "image_prompt": "a detailed image generation prompt for a premium editorial header image, photorealistic editorial photography style, muted blue and grey tones, premium news magazine aesthetic, no text, no watermarks, no overlaid words, max 500 chars"
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
  trustTier?: string;
  rulesPrimary?: string | null;
}): Promise<ArticleOutput> {
  const client = getAzureClient();
  const deployment = getDeployment();

  const framingInstruction = getProbabilityFraming(input.probability);
  const trustContext = getTrustContext(input.trustTier ?? "low");

  const marketData: Record<string, unknown> = {
    title: input.titleRaw,
    outcomes: input.outcomes,
    resolves_at: input.resolvesAt,
    source: input.source,
    current_probability: `${Math.round(input.probability * 100)}%`,
    volume_24h: input.volume24h ? `$${Math.round(input.volume24h).toLocaleString()}` : "N/A",
    liquidity: input.liquidity ? `$${Math.round(input.liquidity).toLocaleString()}` : "N/A",
    delta_24h: input.delta24h != null ? `${input.delta24h > 0 ? "+" : ""}${Math.round(input.delta24h * 100)} pts` : "N/A",
  };

  if (input.rulesPrimary) {
    marketData.resolution_rules = input.rulesPrimary;
  }

  const userContent = [
    JSON.stringify(marketData),
    "",
    `FRAMING: ${framingInstruction}`,
    `TRUST: ${trustContext}`,
  ].join("\n");

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
    image_prompt: "abstract minimalist editorial illustration, muted blue and grey tones, premium news magazine aesthetic, geometric shapes suggesting probability and data, dark background with subtle gradient, no text, no watermarks",
  };
}

export const ARTICLE_PROMPT_HASH = hash(ARTICLE_PROMPT);
