"use client";

import Link from "next/link";
import { Clock3, Star } from "lucide-react";
import type { Shop } from "@/types";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { shopAvailability } from "@/lib/shop-availability";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

/**
 * The card used by every horizontal shop rail — top-rated, favourites, and
 * whatever comes next.
 *
 * Shared rather than copied because those rails sit directly under one
 * another: any drift in radius, image height or badge placement would be
 * visible in a single glance down the page.
 */
export function ShopCarouselCard({
  shop,
  rating,
  waitMin,
}: {
  shop: Shop;
  rating?: { avg_rating: number; review_count: number };
  waitMin?: number;
}) {
  const t = useT(customerExploreDict);
  const businessTypeT = useT(BUSINESS_TYPE_LABEL);
  const availability = shopAvailability(shop);
  const image = shop.cover_image_url ?? shop.logo_url;

  return (
    <Link
      href={`/explore/${shop.id}`}
      className="group flex w-48 shrink-0 flex-col overflow-hidden rounded-[18px] border border-line bg-card shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md"
    >
      <div
        className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden font-display text-3xl font-extrabold text-white"
        style={{ background: shopAvatarColor(shop.id) }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          shopInitial(shop.name)
        )}

        {rating && rating.review_count > 0 && (
          <span className="absolute top-2 left-2 flex items-center gap-0.5 rounded-full bg-card/95 px-1.5 py-0.5 text-[10px] font-bold text-brass shadow-xs backdrop-blur-sm">
            <Star className="h-2.5 w-2.5 fill-current" />
            {rating.avg_rating.toFixed(1)}
          </span>
        )}
        {availability !== "OPEN" && (
          <span
            className={cn(
              "absolute top-2 right-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-xs backdrop-blur-sm",
              availability === "BREAK"
                ? "bg-brass-soft/95 text-brass"
                : "bg-live-soft/95 text-live",
            )}
          >
            {availability === "BREAK" ? t("breakPill") : t("closedBadge")}
          </span>
        )}
      </div>

      <div className="min-w-0 p-3">
        <p className="truncate font-display text-[14px] leading-tight font-bold text-ink">
          {shop.name}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted">
          {businessTypeT(shop.business_type)}
          {rating && rating.review_count > 0 && (
            <span className="text-muted/70"> · {t("reviewsCount", rating.review_count)}</span>
          )}
        </p>
        {/* The same sentence the list cards use, so a shop reads the same
            whichever rail you meet it in. */}
        {waitMin != null && (
          <p
            className={cn(
              "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold",
              waitMin === 0 ? "bg-good-soft text-good" : "bg-live-soft text-live",
            )}
          >
            <Clock3 className="h-2.5 w-2.5" />
            {waitMin === 0 ? t("walkInNow") : t("waitMinutes", waitMin)}
          </p>
        )}
      </div>
    </Link>
  );
}
