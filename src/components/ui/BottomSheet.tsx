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
          "w-full space-y-4 rounded-t-3xl bg-card p-5 pb-6 shadow-lg animate-slide-up sm:rounded-2xl sm:animate-none",
          maxWidthClassName,
        )}
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-line sm:hidden" />
        {title && <h2 className="font-display text-lg font-bold text-ink">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
