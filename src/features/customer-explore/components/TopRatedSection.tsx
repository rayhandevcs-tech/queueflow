"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import type { Shop } from "@/types";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

export function TopRatedSection({
  shops,
  ratingByShopId,
}: {
  shops: Shop[] | undefined;
  ratingByShopId: Map<string, { avg_rating: number; review_count: number }>;
}) {
  const t = useT(customerExploreDict);
  const businessTypeT = useT(BUSINESS_TYPE_LABEL);

  const topRated = (shops ?? [])
    .map((shop) => ({ shop, rating: ratingByShopId.get(shop.id) }))
    .filter((r): r is { shop: Shop; rating: { avg_rating: number; review_count: number } } => !!r.rating)
    .sort((a, b) => b.rating.avg_rating - a.rating.avg_rating)
    .slice(0, 8);

  if (topRated.length === 0) return null;

  return (
    <div className="mb-5">
      <p className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">
        {t("topRatedHeading")}
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {topRated.map(({ shop, rating }) => (
          <Link
            key={shop.id}
            href={`/explore/${shop.id}`}
            className="flex w-36 shrink-0 flex-col gap-2 rounded-2xl border border-line bg-card p-3 shadow-xs transition-transform hover:-translate-y-0.5"
          >
            <div
              className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl font-display text-sm font-extrabold text-white"
              style={{ background: shopAvatarColor(shop.id) }}
            >
              {shop.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.cover_image_url} alt={shop.name} className="h-full w-full object-cover" />
              ) : (
                shopInitial(shop.name)
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-ink">{shop.name}</p>
              <p className="truncate text-[11px] text-muted">{businessTypeT(shop.business_type)}</p>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-ink">
              <Star className="h-3.5 w-3.5 fill-live text-live" />
              <span className="font-number">{rating.avg_rating.toFixed(1)}</span>
              <span className="text-muted">({rating.review_count})</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
