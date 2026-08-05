"use client";

import { useRef } from "react";
import { Pencil } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

export function ProfileHeaderCard({
  name,
  subtitle,
  avatarUrl,
  right,
  onAvatarFileSelected,
  avatarUploading,
}: {
  name: string;
  subtitle: string;
  avatarUrl?: string | null;
  right?: React.ReactNode;
  /** When provided, the avatar itself becomes a tap-to-change photo trigger — no separate avatar block needed elsewhere on the page. */
  onAvatarFileSelected?: (file: File) => void;
  avatarUploading?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const editable = !!onAvatarFileSelected;

  return (
    <div className="flex items-center gap-3.75 rounded-[22px] bg-accent p-5 text-accent-ink">
      <button
        type="button"
        disabled={!editable || avatarUploading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative grid h-15 w-15 shrink-0 place-items-center overflow-hidden rounded-[18px] bg-white font-display text-2xl font-extrabold text-accent",
          editable && "cursor-pointer",
        )}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          name.trim().charAt(0).toUpperCase() || "?"
        )}
        {avatarUploading && (
          <span className="absolute inset-0 grid place-items-center bg-ink/40">
            <Spinner className="h-5 w-5 text-white" />
          </span>
        )}
        {editable && !avatarUploading && (
          <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border border-line bg-white text-accent shadow-sm">
            <Pencil className="h-3 w-3" />
          </span>
        )}
      </button>
      {editable && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAvatarFileSelected(file);
            e.target.value = "";
          }}
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg font-bold">{name || "—"}</p>
        <p className="truncate text-xs text-accent-ink/60">{subtitle || "—"}</p>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
