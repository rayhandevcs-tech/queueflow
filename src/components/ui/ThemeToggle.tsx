"use client";

import { Check, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { THEMES, THEME_LABEL, THEME_SWATCH, useTheme } from "@/lib/theme";

/**
 * The theme switcher: four swatches, one tap each.
 *
 * A row of colours rather than a dropdown, because the choice IS the colour —
 * a list of words would make you pick one, look, and come back. In the
 * sidebars it sits next to the language toggle, which is the other
 * "how this app looks and reads to me" control, so the two are found together.
 *
 * `compact` is the sidebar form (swatches only, on one line); the full form
 * adds the names and is used on the account page, where there is room and
 * where someone may be looking for the setting by name.
 */
export function ThemeToggle({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const label = useT(THEME_LABEL);

  if (compact) {
    return (
      <div
        role="radiogroup"
        aria-label={label(theme)}
        className={cn("inline-flex items-center gap-1 rounded-full bg-soft p-1", className)}
      >
        {THEMES.map((option) => {
          const active = theme === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label(option)}
              title={label(option)}
              onClick={() => setTheme(option)}
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full transition-all",
                active ? "ring-2 ring-accent ring-offset-2 ring-offset-soft" : "hover:opacity-80",
              )}
            >
              <span
                aria-hidden
                className="h-4.5 w-4.5 rounded-full border border-line"
                style={{ background: THEME_SWATCH[option] }}
              />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="radiogroup" className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", className)}>
      {THEMES.map((option) => {
        const active = theme === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all",
              active
                ? "border-accent bg-accent-soft text-ink shadow-xs"
                : "border-line bg-card text-muted hover:border-accent/40 hover:bg-soft",
            )}
          >
            <span
              aria-hidden
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line"
              style={{ background: THEME_SWATCH[option] }}
            >
              {active && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
            </span>
            <span className="min-w-0 truncate">{label(option)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The icon the account page puts beside the theme row. */
export function ThemeIcon({ className }: { className?: string }) {
  return <Palette className={className} />;
}
