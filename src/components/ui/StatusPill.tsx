import { cn } from "@/lib/utils";
import { BADGE_VARIANTS } from "@/components/ui/Badge";

type Tone = "neutral" | "accent" | "good" | "live" | "brass";

const DOT_COLOR: Record<Tone, string> = {
  neutral: "bg-muted",
  accent: "bg-accent",
  good: "bg-good",
  live: "bg-live",
  brass: "bg-brass",
};

export function StatusPill({
  tone = "neutral",
  label,
  dot = true,
  pulse = false,
  className,
}: {
  tone?: Tone;
  label: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        BADGE_VARIANTS[tone],
        className,
      )}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_COLOR[tone], pulse && "animate-pulse-live")}
        />
      )}
      {label}
    </span>
  );
}
