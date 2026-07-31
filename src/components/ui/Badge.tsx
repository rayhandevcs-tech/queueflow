import { cn } from "@/lib/utils";

export const BADGE_VARIANTS = {
  neutral: "bg-soft text-muted",
  accent: "bg-accent/10 text-accent",
  onAccent: "bg-white/15 text-accent-ink",
  good: "bg-good-soft text-good",
  live: "bg-live-soft text-live",
  brass: "bg-brass-soft text-brass",
} as const;

export function Badge({
  variant = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & { variant?: keyof typeof BADGE_VARIANTS }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        BADGE_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
