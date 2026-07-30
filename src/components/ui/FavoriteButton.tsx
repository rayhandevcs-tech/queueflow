"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT, type Dict } from "@/lib/i18n";

const dict = {
  remove: { bn: "প্রিয় তালিকা থেকে সরাও", en: "Remove from favorites" },
  add: { bn: "প্রিয় তালিকায় যোগ করো", en: "Add to favorites" },
} satisfies Dict;

export function FavoriteButton({
  isFavorited,
  onToggle,
  pending,
  className,
}: {
  isFavorited: boolean;
  onToggle: () => void;
  pending?: boolean;
  className?: string;
}) {
  const t = useT(dict);
  return (
    <button
      type="button"
      title={isFavorited ? t("remove") : t("add")}
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "grid h-8.5 w-8.5 shrink-0 place-items-center rounded-full transition-transform hover:scale-105 disabled:opacity-60",
        className,
      )}
    >
      <Heart
        className="h-4 w-4"
        style={{
          color: isFavorited ? "var(--color-accent)" : "var(--color-muted)",
          fill: isFavorited ? "var(--color-accent)" : "transparent",
        }}
      />
    </button>
  );
}
