import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

/**
 * Hover lifts, press settles.
 *
 * The primary used to brighten on hover, which on a saturated red reads as
 * washed out rather than raised. Depth carries the interaction instead: the
 * shadow grows on hover and collapses on press, so the button behaves like a
 * physical key at every size.
 */
const VARIANTS = {
  primary:
    "bg-accent text-accent-ink shadow-sm hover:shadow-glow active:shadow-xs focus-visible:ring-accent/35",
  outline:
    "border border-accent/40 bg-card text-accent shadow-xs hover:border-accent hover:bg-accent/[0.06] hover:shadow-sm focus-visible:ring-accent/30",
  ghost: "text-muted hover:bg-soft hover:text-ink focus-visible:ring-line",
  danger:
    "border border-live/30 bg-card text-live shadow-xs hover:border-live/60 hover:bg-live-soft focus-visible:ring-live/30",
  soft: "bg-soft text-ink hover:bg-line focus-visible:ring-line",
} as const;

/** All ≥44px tall except `sm`, which is only used inline next to body text. */
const SIZES = {
  sm: "h-9 gap-1.5 px-3.5 text-xs",
  md: "h-11 gap-2 px-5 text-sm",
  lg: "h-12.5 gap-2 px-6 text-[15px]",
} as const;

interface Props extends React.ComponentProps<"button"> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  (
    { variant = "primary", size = "md", loading, disabled, className, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        "transition-[box-shadow,background-color,border-color,transform] duration-150",
        // Keyboard users get the ring; mouse users don't see it on click.
        "focus-visible:ring-4 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none",
        "active:translate-y-px",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
