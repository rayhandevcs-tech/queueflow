import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Field height, radius and focus treatment for the whole app.
 *
 * Two deliberate choices: the resting state sits on `--color-soft` and only
 * turns white on focus, which makes the active field obvious without a heavy
 * border; and the focus ring is offset from the border rather than layered on
 * it, so it reads as a ring instead of a thicker outline. 44px is the minimum
 * touch target the project committed to in Sprint 12.
 */
const FIELD_BASE = cn(
  "w-full min-h-11 rounded-[14px] border bg-soft text-[15px] text-ink",
  "transition-[background-color,border-color,box-shadow] duration-150",
  "placeholder:text-muted/70",
  "hover:border-line/80 hover:bg-card",
  "focus:bg-card focus:outline-none focus:ring-4",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

const FIELD_TONE = {
  normal: "border-line focus:border-accent focus:ring-accent/12",
  invalid: "border-live/60 focus:border-live focus:ring-live/15",
} as const;

interface Props extends React.ComponentProps<"input"> {
  invalid?: boolean;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ invalid, icon, className, ...props }, ref) => {
    const tone = invalid ? FIELD_TONE.invalid : FIELD_TONE.normal;

    if (icon) {
      return (
        <div className="group relative">
          {/* Tints with the field so the icon belongs to it rather than
              floating on top — and turns brand-coloured on focus. */}
          <span
            className={cn(
              "pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 transition-colors",
              invalid ? "text-live/70" : "text-muted group-focus-within:text-accent",
            )}
          >
            {icon}
          </span>
          <input
            ref={ref}
            aria-invalid={invalid || undefined}
            className={cn(FIELD_BASE, tone, "pr-3.5 pl-11", className)}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(FIELD_BASE, tone, "px-3.5", className)}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

/**
 * The multi-line twin of Input.
 *
 * Every long-text field in the app had been hand-rolling
 * `rounded-[14px] border-line bg-soft …`, which is how a focus ring ends up on
 * some fields and not others. Sharing FIELD_BASE means a textarea now focuses,
 * hovers and reports invalidity exactly like a single-line field.
 */
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea"> & { invalid?: boolean }
>(({ invalid, className, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      FIELD_BASE,
      invalid ? FIELD_TONE.invalid : FIELD_TONE.normal,
      "resize-none px-3.5 py-3 leading-relaxed",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

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
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="block text-[13px] font-semibold text-ink">{label}</label>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-live">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
