"use client";

import { cn } from "@/lib/utils";

/**
 * A segmented control.
 *
 * Previously two independent buttons where the selected one turned solid red —
 * which reads as "one button is active" rather than "this is a choice between
 * two". Now the group is a single inset track with a white thumb that slides
 * between positions, the way a segmented control is supposed to behave: the
 * unselected option stays legible, and the movement makes the switch obvious.
 */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
  ariaLabel,
}: {
  options: readonly {
    value: T;
    label: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
  value: T | undefined;
  onChange: (value: T) => void;
  columns?: number;
  ariaLabel?: string;
}) {
  const selectedIndex = options.findIndex((o) => o.value === value);
  const count = options.length;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "relative grid gap-1 rounded-[16px] border border-line bg-soft p-1",
        columns === 3 ? "grid-cols-3" : "grid-cols-2",
      )}
    >
      {/* The thumb. Absolutely positioned so it can transition between slots
          instead of each button re-painting its own background. */}
      {selectedIndex >= 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-xl bg-accent shadow-sm transition-transform duration-200 ease-out"
          style={{
            width: `calc((100% - 0.5rem - ${(count - 1) * 0.25}rem) / ${count})`,
            transform: `translateX(calc(${selectedIndex} * (100% + 0.25rem)))`,
          }}
        />
      )}

      {options.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative z-10 flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2.5",
              "text-sm font-semibold transition-colors duration-200",
              "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
              selected ? "text-accent-ink" : "text-muted hover:text-ink",
            )}
          >
            {Icon && <Icon className="h-4.5 w-4.5" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
