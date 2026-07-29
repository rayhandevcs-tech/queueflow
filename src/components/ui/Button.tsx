import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";

const VARIANTS = {
  primary:
    "bg-accent text-accent-ink shadow-sm hover:shadow-md hover:brightness-110 active:brightness-95",
  outline:
    "border border-accent bg-card text-accent shadow-xs hover:bg-accent/10",
  ghost: "text-muted hover:bg-soft hover:text-ink",
  danger:
    "border border-live/30 bg-card text-live shadow-xs hover:bg-live-soft",
  soft: "bg-soft text-ink hover:bg-line",
} as const;

const SIZES = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-6 text-sm",
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
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold transition-all duration-150",
        "disabled:pointer-events-none disabled:opacity-50",
        "active:scale-[0.97]",
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
