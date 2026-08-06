"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { chatDict } from "../lib/i18n";

/**
 * A chat photo that fades in when it decodes instead of popping in at full
 * opacity over a blank box, and opens full-size on click. Nothing here touches
 * upload or message data — the grid only ever renders URLs it is handed.
 */
function ChatImage({
  url,
  alt,
  className,
  onOpen,
}: {
  url: string;
  alt: string;
  className?: string;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={alt}
      className={cn(
        "group/img relative block overflow-hidden rounded-[14px] bg-soft",
        "focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none",
        className,
      )}
    >
      {!loaded && <span aria-hidden className="absolute inset-0 animate-shimmer bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--color-soft)_25%,var(--color-line)_50%,var(--color-soft)_75%)] motion-reduce:animate-none" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-[opacity,transform] duration-300 ease-out",
          "group-hover/img:scale-[1.03]",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[14px] ring-1 ring-ink/5 transition-colors group-hover/img:bg-ink/5"
      />
    </button>
  );
}

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const t = useT(chatDict);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 grid animate-fade-up place-items-center bg-ink/75 p-4"
    >
      <button
        type="button"
        onClick={onClose}
        title={t("closeImageTitle")}
        aria-label={t("closeImageTitle")}
        className="absolute top-4 right-4 grid h-11 w-11 place-items-center rounded-full bg-card text-ink shadow-md transition-transform hover:scale-105 active:scale-95"
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-lg"
      />
    </div>
  );
}

export function MessageImageGrid({ urls }: { urls: string[] }) {
  const t = useT(chatDict);
  const [preview, setPreview] = useState<string | null>(null);

  if (urls.length === 0) return null;

  const visible = urls.slice(0, 4);
  const overflow = urls.length - 4;

  return (
    <>
      {urls.length === 1 ? (
        <ChatImage
          url={urls[0]}
          alt={t("openImageTitle")}
          onOpen={() => setPreview(urls[0])}
          className="mb-1.5 h-60 w-full shadow-xs"
        />
      ) : (
        <div className="mb-1.5 grid grid-cols-2 gap-1">
          {visible.map((url, i) => (
            <div key={url} className="relative">
              <ChatImage
                url={url}
                alt={t("openImageTitle")}
                onOpen={() => setPreview(url)}
                className="aspect-square w-full shadow-xs"
              />
              {i === 3 && overflow > 0 && (
                <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-[14px] bg-ink/55 font-number text-sm font-bold text-white">
                  +{overflow}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {preview && <Lightbox url={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
