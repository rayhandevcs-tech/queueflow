"use client";

import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { MAX_TICKET_IMAGES } from "../api/storage.api";
import { supportDict } from "../lib/i18n";

/**
 * Pick-and-preview for ticket screenshots. Previews come from object URLs, so
 * nothing is uploaded until the ticket is actually submitted — a file chosen
 * and then removed never reaches storage.
 */
export function ImagePickerRow({
  files,
  onChange,
  disabled,
}: {
  files: File[];
  onChange: (next: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useT(supportDict);
  const full = files.length >= MAX_TICKET_IMAGES;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {files.map((file, i) => (
        <div
          key={`${file.name}-${i}`}
          className="relative h-20 w-20 overflow-hidden rounded-[14px] border border-line bg-soft"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange(files.filter((_, index) => index !== i))}
            aria-label={t("removeImage")}
            className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-ink/65 text-white transition-colors hover:bg-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {!full && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "grid h-20 w-20 place-items-center gap-1 rounded-[14px] border border-dashed border-line",
            "text-muted transition-colors hover:border-accent/50 hover:bg-soft hover:text-accent",
            "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <ImagePlus className="h-5 w-5" />
          <span className="sr-only">{t("addScreenshot")}</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          onChange([...files, ...picked].slice(0, MAX_TICKET_IMAGES));
          e.target.value = "";
        }}
      />
    </div>
  );
}
