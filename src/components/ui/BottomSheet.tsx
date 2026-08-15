"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  maxWidthClassName = "max-w-sm",
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-30 grid place-items-end bg-ink/50 p-4 backdrop-blur-sm sm:place-items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          // The sheet is capped at the viewport and scrolls inside itself.
          // Without the cap a tall sheet (the walk-in form's service grid, say)
          // simply grew past the bottom of the screen, and because the backdrop
          // is `fixed inset-0` with nothing scrollable, its submit button was
          // unreachable on a phone. dvh, not vh, so the browser's own chrome
          // sliding in and out doesn't hide the last row.
          "flex max-h-[calc(100dvh-2rem)] w-full flex-col gap-4 rounded-t-3xl bg-card p-5 pb-6 shadow-lg animate-slide-up sm:rounded-2xl sm:animate-none",
          maxWidthClassName,
        )}
      >
        <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-line sm:hidden" />
        {title && (
          <h2 className="shrink-0 font-display text-lg font-bold text-ink">{title}</h2>
        )}
        {/* No flex-1 here. The panel's height is auto (only capped by
            max-h), and `flex: 1 1 0%` in an auto-height column resolves its
            basis to 0 — with min-h-0 removing the automatic minimum, the box
            collapsed and a short sheet grew a scrollbar it did not need.
            Default basis plus min-h-0 is what's wanted: size to the content,
            shrink only once the cap is reached, and scroll from there.
            -mx-5/px-5 keeps focus rings from being clipped. */}
        <div className="-mx-5 min-h-0 shrink space-y-4 overflow-y-auto px-5">
          {children}
        </div>
      </div>
    </div>
  );
}
