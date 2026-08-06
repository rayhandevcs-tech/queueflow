"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Attachments on a ticket message. Small thumbnails that open full-size,
 * because a screenshot is evidence to be read, not decoration — but it should
 * not push the message text off the screen either.
 */
export function TicketImageStrip({ urls }: { urls: string[] }) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview]);

  if (urls.length === 0) return null;

  return (
    <>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {urls.map((url) => (
          <button
            key={url}
            type="button"
            onClick={() => setPreview(url)}
            className={cn(
              "h-20 w-20 overflow-hidden rounded-[14px] border border-line bg-soft",
              "transition-transform duration-150 hover:scale-[1.03]",
              "focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-50 grid animate-fade-up place-items-center bg-ink/75 p-4"
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 grid h-11 w-11 place-items-center rounded-full bg-card text-ink shadow-md transition-transform hover:scale-105 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-lg"
          />
        </div>
      )}
    </>
  );
}
