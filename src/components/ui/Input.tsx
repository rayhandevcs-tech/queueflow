import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface Props extends React.ComponentProps<"input"> {
  invalid?: boolean;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ invalid, icon, className, ...props }, ref) => {
    if (icon) {
      return (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            {icon}
          </span>
          <input
            ref={ref}
            className={cn(
              "w-full rounded-lg border bg-card py-2.5 pl-9 pr-3 text-sm text-ink shadow-xs transition-colors placeholder:text-muted/60",
              "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25",
              invalid ? "border-live/60" : "border-line",
              className,
            )}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm text-ink shadow-xs transition-colors placeholder:text-muted/60",
          "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25",
          invalid ? "border-live/60" : "border-line",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="text-sm font-medium text-ink">{label}</label>}
      {children}
      {error ? (
        <p className="text-xs font-medium text-live">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
