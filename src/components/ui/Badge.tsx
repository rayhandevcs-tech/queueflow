import { cn } from "@/lib/utils";

const VARIANTS = {
  neutral: "bg-soft text-muted",
  accent: "bg-accent/10 text-accent",
  good: "bg-good-soft text-good",
  live: "bg-live-soft text-live",
  brass: "bg-brass-soft text-brass",
} as const;

export function Badge({
  variant = "neutral",
  className,
  ...props
}: React.ComponentProps<"span"> & { variant?: keyof typeof VARIANTS }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
