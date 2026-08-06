import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { site } from "@/config/site";

/**
 * The brand, everywhere it appears.
 *
 * The old `Logo` set the name at `text-sm` — smaller than the nav links beside
 * it, which made the product name the quietest thing on screen. This replaces
 * it with a real scale: the mark and the name grow together, the name is set
 * in the display face at extra-bold with tightened tracking, and an optional
 * `sub` line carries the qualifier ("এডমিন প্যানেল") *under* the brand rather
 * than in place of it.
 *
 * `tone="onAccent"` is for the coloured auth panel, where ink-on-white would
 * disappear.
 */
/**
 * One step up at every size (Sprint 38). The name was still reading as a label
 * beside the mark rather than as the product's name — on the nav bars and on
 * the auth screens especially, where it is the only branding on the page.
 */
const SIZES = {
  sm: { mark: "h-9 w-9 rounded-[14px]", icon: "h-4.5 w-4.5", name: "text-[18px]", gap: "gap-2.5" },
  md: { mark: "h-11 w-11 rounded-2xl", icon: "h-5.5 w-5.5", name: "text-[23px]", gap: "gap-2.75" },
  lg: { mark: "h-14 w-14 rounded-2xl", icon: "h-7 w-7", name: "text-[30px]", gap: "gap-3.25" },
} as const;

export function Wordmark({
  size = "sm",
  tone = "ink",
  sub,
  className,
}: {
  size?: keyof typeof SIZES;
  tone?: "ink" | "onAccent";
  sub?: string;
  className?: string;
}) {
  const s = SIZES[size];
  const onAccent = tone === "onAccent";

  return (
    <span className={cn("flex items-center", s.gap, className)}>
      <span
        className={cn(
          "grid shrink-0 place-items-center",
          s.mark,
          onAccent
            ? "bg-accent-ink/15 text-accent-ink ring-1 ring-accent-ink/20"
            : "bg-accent text-accent-ink shadow-sm",
        )}
      >
        <Sparkles className={s.icon} />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate font-display font-extrabold tracking-tight",
            s.name,
            onAccent ? "text-accent-ink" : "text-ink",
          )}
        >
          {site.name}
        </span>
        {sub && (
          <span
            className={cn(
              "block truncate text-[11px] font-semibold",
              onAccent ? "text-accent-ink/60" : "text-muted",
            )}
          >
            {sub}
          </span>
        )}
      </span>
    </span>
  );
}
