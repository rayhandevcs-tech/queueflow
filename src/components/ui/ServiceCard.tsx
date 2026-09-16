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
  categoryLabel,
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
  /**
   * The service's category, shown as a quiet kicker above the name.
   *
   * There is no `description` column on `services`, so the card cannot show
   * one without inventing it. The category is the real piece of grouping
   * information the schema does carry, and it does the same job for scanning:
   * it tells you what KIND of thing you are looking at before you read what it
   * is called.
   */
  categoryLabel?: string | null;
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
          "relative block aspect-4/3 w-full overflow-hidden rounded-[14px] bg-soft sm:aspect-square",
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

      </span>

      <span className="mt-3 block min-w-0 px-0.5">
        {/* The tick used to sit on top of the photo, covering the part of the
            picture the owner chose it for. It reads just as clearly beside the
            name, where it has the border and tint of the whole card behind
            it — and the picture stays a picture. */}
        {categoryLabel && (
          <span className="mb-1 block truncate text-[10px] font-semibold tracking-[0.06em] text-muted uppercase">
            {categoryLabel}
          </span>
        )}
        <span className="flex items-start gap-1.5">
          {selectable && (
            <span
              aria-hidden
              className={cn(
                "mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-md border transition-colors",
                selected
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-line bg-card text-transparent",
              )}
              style={{ borderWidth: 1.5 }}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
          )}
          {/* Wraps rather than truncates: at two cards across, "Hair Cutting"
              was being cut to "Hair …" — a service you cannot read is not a
              service you can choose. */}
          <span
            className={cn(
              "min-w-0 flex-1 text-[15px] leading-[1.3] font-bold break-words text-ink",
              // Two lines, always: without a floor the price jumps up and down
              // between neighbouring cards, and without a ceiling one wordy
              // service makes the whole row tall.
              "line-clamp-2 min-h-[2.6em]",
              dimmed && "text-muted line-through",
            )}
          >
            {name}
          </span>
        </span>
        <span className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <span className="font-number text-[17px] leading-none font-bold text-ink tabular-nums">
            {priceLabel}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-soft px-2 py-0.5 text-[11px] font-semibold text-muted">
            <Clock3 className="h-3 w-3" />
            {durationLabel}
          </span>
        </span>
        {badge && <span className="mt-2 block">{badge}</span>}
      </span>
    </>
  );

  const shell = cn(
    "relative rounded-[20px] border bg-card p-3 text-left transition-all duration-200",
    selected
      ? "border-accent bg-accent/[0.06] shadow-sm"
      : "border-line hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-sm",
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
      {action && <div className="absolute top-2 right-2">{action}</div>}
    </div>
  );
}

/**
 * The grid these belong in.
 *
 * Two across on a phone is deliberate — it is what makes the photo big enough
 * to be worth having. What was wrong was everything above that: `sm:` put a
 * THIRD column in at 640px, so on a large phone held sideways or a small
 * tablet each card was about 100px wide and the name broke across three lines.
 * That is the cramped look, and it came from the container, not the card.
 *
 * So the columns now widen with the screen instead of multiplying as soon as
 * they can: two until there is genuinely room for three at `md`, and a fourth
 * only on a proper desktop. The gap grows with them, because cards that are
 * bigger need more space between them to still read as separate things.
 */
export function ServiceCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
      {children}
    </div>
  );
}
