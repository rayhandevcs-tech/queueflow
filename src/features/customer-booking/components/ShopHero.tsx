"use client";

import { ChevronLeft, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import type { Shop } from "@/types";
import type { ReviewSummary } from "@/lib/reviews";

interface Props {
  shop: Shop;
  summary: ReviewSummary;
}

export function ShopHero({ shop, summary }: Props) {
  const router = useRouter();

  return (
    <div
      className="relative h-40 w-full overflow-hidden sm:rounded-2xl"
      style={{
        background: shop.cover_image_url
          ? undefined
          : "linear-gradient(120deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, black))",
      }}
    >
      {shop.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shop.cover_image_url}
          alt={shop.name}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/0" />

      <button
        type="button"
        onClick={() => router.push("/explore")}
        className="absolute left-4 top-3.5 grid h-9 w-9 place-items-center rounded-[11px] bg-white/20 text-white"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {summary.count > 0 && (
        <div className="absolute bottom-3.5 right-4 flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-xs font-bold text-ink shadow-lg">
          <Star className="h-3.5 w-3.5 fill-brass text-brass" />
          {summary.average}
          <span className="font-normal text-muted">({summary.count})</span>
        </div>
      )}

      <div className="absolute bottom-3.5 left-4 max-w-[70%]">
        <p className="truncate font-display text-lg font-bold text-white drop-shadow">
          {shop.name}
        </p>
        <p className="truncate text-xs text-white/85">
          {BUSINESS_TYPE_LABEL[shop.business_type]}
          {shop.address ? ` · ${shop.address}` : ""}
        </p>
      </div>
    </div>
  );
}
