import { getAzureClient, getDeployment } from "./client.js";
import { createHash } from "crypto";
import { z } from "zod";

const SITE_NAME = "PreNews";
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://prenews.news";

// Relaxed schema — we truncate fields after parsing rather than rejecting
export const articleOutputSchema = z.object({
  headline: z.string(),
  headline_short: z.string(),
  meta_description: z.string(),
  category: z.string(),
  tags: z.array(z.string()).max(10),
  body: z.string(),
  image_prompt: z.string(),
});

/** Truncate fields to fit DB constraints and UI expectations */
function sanitizeArticle(raw: z.infer<typeof articleOutputSchema>): z.infer<typeof articleOutputSchema> {
  const truncate = (s: string, max: number) =>
    s.length <= max ? s : s.slice(0, max - 3).trimEnd() + "...";

  return {
    ...raw,
    headline: truncate(raw.headline.replace(/\?+$/, "").trim(), 120),
    headline_short: truncate(raw.headline_short, 60),
    meta_description: truncate(raw.meta_description, 320),
    image_prompt: truncate(raw.image_prompt, 800),
    tags: raw.tags.slice(0, 5),
  };
}

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

const ARTICLE_PROMPT = `You are a senior editorial writer for ${SITE_NAME} (${SITE_URL}), a market-probability news platform. Your job is to transform raw prediction market data into short, high-quality news articles that give readers real journalistic context.

WRITING STYLE:
- Write like a Bloomberg or Reuters correspondent — neutral, authoritative, no opinion
- The headline should read like a real newspaper headline (declarative, no question marks, no clickbait)
- The article body should be SHORT (100-200 words) but provide real context:
  1. Lead with the key finding: what the market is pricing and at what probability
  2. Provide brief background context so a reader unfamiliar with the topic understands what is happening and why it matters. Use general knowledge — e.g. who the people involved are, what the policy implications are, what happened recently to move the market
  3. Close with the market data: mention the probability, and note the resolution timeline
- Do NOT editorialize or take political sides. Just explain what is happening factually
- Do NOT fabricate specific news events, quotes, or statistics — but you CAN reference widely known public context (e.g. "Trump has publicly discussed potential nominees" or "The Fed held rates steady at its last meeting")
- Naturally mention "${SITE_NAME}" once in the body

PROBABILITY-ADAPTIVE FRAMING:
Adjust your tone based on the probability level provided in the framing instructions below the market data.

TRUST CONTEXT:
Use the trust tier context to add appropriate hedging language. High-trust markets can be discussed with more confidence; low-trust markets should include caveats about thin liquidity.

RESOLUTION CRITERIA:
If resolution rules are provided, use them to explain how this market resolves.

MULTI-OUTCOME MARKETS:
If the market has more than 2 outcomes, focus on the leading outcome and its nearest competitor.

IMAGE PROMPT:
Generate a detailed prompt for a hyper-photorealistic cover image that a premium newspaper like the New York Times would use for this story. Think: editorial photography, photojournalism, landscape composition. The image should visually represent the subject matter of the story — real-world scenes, people, places, or objects relevant to the topic. NO abstract art, NO geometric shapes, NO data visualizations, NO text overlays, NO watermarks. Aim for cinematic lighting, shallow depth of field, natural color grading.

Output format (strict JSON):
{
  "headline": "max 80 chars, declarative newspaper headline, no question marks",
  "headline_short": "max 50 chars, for cards/social",
  "meta_description": "max 320 chars, SEO meta description mentioning ${SITE_NAME} and the key probability",
  "category": "one of: politics, economics, technology, crypto, science, sports, entertainment, world, other",
  "tags": ["1-5 lowercase tags"],
  "body": "100-200 word article body in markdown (use ## for one subheading if needed, **bold** for key figures)",
  "image_prompt": "hyper-photorealistic editorial photograph prompt, landscape orientation, cinematic lighting, relevant to the story subject, max 500 chars"
}

Rules:
- No question marks in headline
- No sensational/clickbait terms (no: shocking, breaking, bombshell, explosive, devastating, etc.)
- Article must mention the probability percentage prominently
- Keep body concise: 100-200 words, not more
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

  return sanitizeArticle(parsed.data);
}

export function validateArticle(output: ArticleOutput): boolean {
  if (output.headline.includes("?")) return false;
  if (output.headline.length > 120) return false;
  if (output.body.length < 50) return false;

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
    image_prompt: "hyper-photorealistic editorial photograph of a modern newsroom with multiple screens showing financial data, cinematic lighting, shallow depth of field, natural color grading, landscape orientation, no text overlays, no watermarks",
  };
}

export const ARTICLE_PROMPT_HASH = hash(ARTICLE_PROMPT);
