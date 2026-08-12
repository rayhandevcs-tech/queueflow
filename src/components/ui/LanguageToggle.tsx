"use client";

import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

/**
 * The language switch, one component for all three sidebars.
 *
 * It was hand-rolled in each of them, which is how the customer's copy ended
 * up squeezed to "বাং | E" while the others were fine. Shape: a soft track
 * with the active language as a filled disc — the disc is what makes the
 * current state readable at a glance, without a label explaining what the
 * control is.
 */
export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  const option = (active: boolean) =>
    cn(
      "grid h-9 min-w-9 place-items-center rounded-full px-2.5 text-[12px] font-bold transition-all",
      active ? "bg-accent text-accent-ink shadow-sm" : "text-muted",
    );

  return (
    <button
      type="button"
      role="switch"
      aria-checked={language === "en"}
      aria-label={language === "bn" ? "Switch to English" : "বাংলায় বদলাও"}
      onClick={() => setLanguage(language === "bn" ? "en" : "bn")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-soft p-1",
        className,
      )}
    >
      <span className={option(language === "bn")}>বাং</span>
      <span className={option(language === "en")}>Eng</span>
    </button>
  );
}
