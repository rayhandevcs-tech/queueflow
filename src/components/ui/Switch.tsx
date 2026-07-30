"use client";

import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onChange,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative h-6.5 w-11.5 shrink-0 rounded-full transition-colors duration-150",
        checked ? "bg-accent" : "bg-line",
        disabled && "opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow-sm transition-transform duration-150",
          checked ? "translate-x-[calc(100%+2px)]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
