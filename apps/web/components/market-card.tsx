import Link from "next/link";
import { TrustBadge } from "./trust-badge";
import { DeltaBadge } from "./delta-badge";
import { Sparkline } from "./sparkline";

export interface MarketCardProps {
  slug: string;
  headline: string;
  probabilityText: string;
  category: string | null;
  resolvesInText: string;
  trustTier: string;
  source: string;
  volumeText?: string;
  delta24hText?: string | null;
  delta1hText?: string | null;
  rank?: number;
  showMovement?: boolean;
  imageUrl?: string | null;
  sparkline?: number[];
}

export function MarketCard({
  slug,
  headline,
  probabilityText,
  category,
  resolvesInText,
  trustTier,
  source,
  volumeText,
  delta24hText,
  delta1hText,
  rank,
  showMovement = false,
  imageUrl,
  sparkline,
}: MarketCardProps) {
  return (
    <Link
      href={`/m/${slug}`}
      className="group block rounded-[10px] border border-border bg-card p-4 transition-colors hover:bg-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-3">
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="hidden sm:block w-16 h-16 rounded-md object-cover shrink-0"
            loading="lazy"
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            {category && (
              <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                {category}
              </span>
            )}
            <TrustBadge tier={trustTier} />
          </div>

          <h3 className="text-sm font-medium leading-snug text-text line-clamp-2">
            {headline}
          </h3>

          <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
            <span>{resolvesInText}</span>
            <span className="text-border">|</span>
            <span className="capitalize">{source}</span>
            {volumeText && (
              <>
                <span className="text-border">|</span>
                <span>Total Vol {volumeText}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-xl font-semibold tabular-nums text-text">
            {probabilityText}
          </span>
          {sparkline && sparkline.length >= 2 && (
            <Sparkline data={sparkline} />
          )}
          {showMovement && (delta24hText || delta1hText) && (
            <DeltaBadge text={delta24hText ?? delta1hText ?? null} />
          )}
        </div>
      </div>
    </Link>
  );
}
