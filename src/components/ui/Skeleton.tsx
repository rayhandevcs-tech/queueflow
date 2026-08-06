import { cn } from "@/lib/utils";

/**
 * A loading placeholder shaped like the thing it stands in for.
 *
 * A spinner tells you something is happening; a skeleton tells you what is
 * about to arrive, so the layout doesn't jump when it does. The sweep runs on
 * the background position rather than opacity, which keeps it calm — the
 * surface stays the same weight throughout instead of blinking.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer bg-[length:200%_100%]",
        "bg-[linear-gradient(90deg,var(--color-soft)_25%,var(--color-line)_50%,var(--color-soft)_75%)]",
        "motion-reduce:animate-none",
        className,
      )}
    />
  );
}
