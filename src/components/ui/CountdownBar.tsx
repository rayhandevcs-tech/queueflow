import { cn } from "@/lib/utils";

export function CountdownBar({
  progress,
  trackClassName = "bg-white/10",
  barClassName = "bg-live",
  className,
}: {
  /** Fraction of time remaining, 1 = full, 0 = done. */
  progress: number;
  trackClassName?: string;
  barClassName?: string;
  className?: string;
}) {
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <div className={cn("h-3 w-full overflow-hidden rounded-full", trackClassName, className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", barClassName)}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
