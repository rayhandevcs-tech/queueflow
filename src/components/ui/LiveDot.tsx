import { cn } from "@/lib/utils";

const VARIANTS = {
  live: "bg-live",
  good: "bg-good",
  accent: "bg-accent",
} as const;

export function LiveDot({
  variant = "live",
  className,
}: {
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex h-2 w-2", className)}>
      <span
        className={cn(
          "absolute inline-flex h-full w-full rounded-full animate-pulse-live",
          VARIANTS[variant],
        )}
      />
    </span>
  );
}
