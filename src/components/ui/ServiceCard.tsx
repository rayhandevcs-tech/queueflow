"use client";

import { useState } from "react";
import { Check, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One service, everywhere a service is shown.
 *
 * There were three of these — the catalogue manager, the walk-in dialog and
 * the customer's booking tab — each a wide row with a thumbnail the size of a
 * favicon. A service is a thing you look at before you choose it, so the photo
 * the owner bothered to upload should be the largest part of the card, not a
 * decoration beside the text. Narrow card, big picture, details underneath.
 *
 * Presentational only: no data fetching, no mutations. Whoever renders it owns
 * what tapping means.
 */
export function ServiceCard({
  name,
  imageUrl,
  fallbackIcon,
  durationLabel,
  priceLabel,
  selected = false,
  selectable = false,
  dimmed = false,
  onClick,
  badge,
  action,
  className,
}: {
  name: string;
  imageUrl?: string | null;
  /** Category glyph, shown when there is no photo or the photo won't load. */
  fallbackIcon: React.ReactNode;
  durationLabel: string;
  priceLabel: string;
  selected?: boolean;
  /** Draws the tick affordance — the walk-in and booking pickers set this. */
  selectable?: boolean;
  /** Inactive service: readable, clearly not in play. */
  dimmed?: boolean;
  onClick?: () => void;
  /** Status pill etc., rendered under the price. */
  badge?: React.ReactNode;
  /** Trailing control (delete…), pinned to the card's corner. */
  action?: React.ReactNode;
  className?: string;
}) {
  // A dead URL would otherwise leave the browser's broken-image glyph in the
  // middle of the card, which looks worse than never having had a photo.
  const [broken, setBroken] = useState(false);
  const showImage = !!imageUrl && !broken;

  const body = (
    <>
      <span
        className={cn(
          "relative block aspect-square w-full overflow-hidden rounded-[14px] bg-soft",
          dimmed && "opacity-55",
        )}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-muted">{fallbackIcon}</span>
        )}

        {selectable && (
          <span
            aria-hidden
            className={cn(
              "absolute top-2 right-2 grid h-6.5 w-6.5 place-items-center rounded-full border transition-all",
              selected
                ? "border-accent bg-accent text-accent-ink"
                : "border-white/70 bg-black/25 text-transparent backdrop-blur-sm",
            )}
            style={{ borderWidth: 1.5 }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        )}
      </span>

      <span className="mt-2.5 block min-w-0">
        <span
          className={cn(
            "block truncate text-sm font-bold text-ink",
            dimmed && "text-muted line-through",
          )}
        >
          {name}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted">
            <Clock3 className="h-3 w-3" />
            {durationLabel}
          </span>
          <span className="font-number text-[15px] font-bold text-ink tabular-nums">
            {priceLabel}
          </span>
        </span>
        {badge && <span className="mt-1.5 block">{badge}</span>}
      </span>
    </>
  );

  const shell = cn(
    "relative rounded-[18px] border bg-card p-2.5 text-left transition-all",
    selected ? "border-accent bg-accent/[0.06] shadow-xs" : "border-line hover:bg-soft",
    className,
  );

  return (
    <div className={shell} style={{ borderWidth: 1.5 }}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-pressed={selectable ? selected : undefined}
          className="block w-full text-left"
        >
          {body}
        </button>
      ) : (
        body
      )}
      {action && <div className="absolute top-1.5 right-1.5">{action}</div>}
    </div>
  );
}

/**
 * The grid these belong in. Narrow columns on purpose — two across on a phone
 * is what makes the photo big enough to be worth having.
 */
export function ServiceCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
  );
}
