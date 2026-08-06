import { cn } from "@/lib/utils";

/**
 * Every raised surface in the app.
 *
 * One component with tones rather than a dozen hand-rolled
 * `rounded-… border-line bg-card shadow-…` strings: that repetition is how
 * radii and shadows drift apart screen by screen. Tones are washes over the
 * same white surface — never a filled block — so the whole app reads as one
 * material with accents on it.
 */
const TONES = {
  plain: "bg-card border-line",
  /** Barely-there warm wash — for a surface that should recede a step. */
  soft: "bg-gradient-to-b from-card to-soft/60 border-line",
  accent: "bg-gradient-to-br from-accent/[0.07] to-accent/[0.02] border-accent/20",
  good: "bg-gradient-to-br from-good-soft/70 to-good-soft/20 border-good/20",
  live: "bg-gradient-to-br from-live-soft/70 to-live-soft/20 border-live/20",
  brass: "bg-gradient-to-br from-brass-soft/70 to-brass-soft/20 border-brass/25",
} as const;

export type CardTone = keyof typeof TONES;

export function Card({
  className,
  tone = "plain",
  hover,
  ...props
}: React.ComponentProps<"div"> & { tone?: CardTone; hover?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-3xl border shadow-sm",
        TONES[tone],
        hover &&
          "transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}
