"use client";

import Link from "next/link";
import { ArrowUpRight, Clock3, MapPin, ShieldCheck, Star } from "lucide-react";
import type { Shop } from "@/types";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { useAuthGate } from "@/components/auth/AuthGate";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { catalogueStatus } from "@/lib/shop-catalogue";
import { cn } from "@/lib/utils";
import { useMyFavoriteShopIds, useToggleFavorite } from "../hooks/use-favorites";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

/**
 * The card used by every horizontal shop rail — top-rated, favourites, and
 * whatever comes next.
 *
 * Shared rather than copied because those rails sit directly under one
 * another: any drift in radius, image height or badge placement would be
 * visible in a single glance down the page.
 *
 * ---------------------------------------------------------------------------
 * What the polish pass changed, and why
 * ---------------------------------------------------------------------------
 * The card was 192px wide and carried the shop's name, its type and a wait
 * pill. Two things were wrong with that. It had no ADDRESS, which is the
 * question you actually ask about a shop you are considering — "GentleMen,
 * salon, 3 reviews" does not tell you whether it is near you. And the rating
 * showed an average with no count, so 5.0 from one friend looked better than
 * 4.7 from ninety.
 *
 * Both were already in the data being passed in. So this is a presentation
 * change only: no new query, no new prop from the caller, nothing invented.
 * The card is a little wider to fit it, and the name is allowed two lines
 * rather than being truncated mid-word.
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
  const status = catalogueStatus(shop);
  const byAppointment = status === "BY_APPOINTMENT";
  const image = shop.cover_image_url ?? shop.logo_url;

  const { guard } = useAuthGate();
  const { data: favoriteIds } = useMyFavoriteShopIds();
  const toggleFavorite = useToggleFavorite();
  const favorited = favoriteIds?.has(shop.id) ?? false;

  return (
    <Link
      href={`/explore/${shop.id}`}
      className={cn(
        "group flex w-52 shrink-0 flex-col overflow-hidden rounded-[20px] border border-line bg-card",
        "shadow-xs transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md",
        "sm:w-56",
      )}
    >
      <div
        className="relative grid aspect-4/3 w-full place-items-center overflow-hidden font-display text-3xl font-extrabold text-white"
        style={{ background: shopAvatarColor(shop.id) }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          shopInitial(shop.name)
        )}

        {/* The rating now carries its sample size. An average without a count
            is the one number on this card that can actively mislead. */}
        {rating && rating.review_count > 0 && (
          <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-card/95 px-2 py-0.5 text-[10px] font-bold text-brass shadow-xs backdrop-blur-sm">
            <Star className="h-2.5 w-2.5 fill-current" />
            <span className="font-number">{rating.avg_rating.toFixed(1)}</span>
            <span className="font-number font-semibold opacity-70">
              ({rating.review_count})
            </span>
          </span>
        )}

        {status !== "OPEN" && !byAppointment && (
          <span
            className={cn(
              "absolute right-2 bottom-2 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-xs backdrop-blur-sm",
              status === "BREAK"
                ? "bg-brass-soft/95 text-brass"
                : "bg-live-soft/95 text-live",
            )}
          >
            {status === "BREAK" ? t("breakPill") : t("closedBadge")}
          </span>
        )}

        {/* FavoriteButton stops the click from reaching the Link itself, which
            is how ShopList already nests it inside a card-wide anchor. */}
        <FavoriteButton
          isFavorited={favorited}
          pending={toggleFavorite.isPending}
          onToggle={guard(() =>
            toggleFavorite.mutate({ shopId: shop.id, isFavorited: favorited }),
          )}
          className="absolute top-1.5 right-1.5 bg-card/90 shadow-xs backdrop-blur-sm"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3.5">
        <p className="flex items-center gap-1.5 text-[11px] leading-none">
          <span className="shrink-0 font-semibold text-accent">
            {businessTypeT(shop.business_type)}
          </span>
          {shop.women_only && (
            <span className="flex shrink-0 items-center gap-0.5 font-semibold text-accent">
              <ShieldCheck className="h-2.5 w-2.5" />
              {t("womenOnlyBadge")}
            </span>
          )}
        </p>

        {/* Two lines rather than one truncated one: "The Capital Hair Selun"
            was being cut to "The Capital Hair…" at this width. */}
        <p className="mt-1.5 line-clamp-2 font-display text-[15px] leading-[1.25] font-bold text-ink">
          {shop.name}
        </p>

        {shop.address && (
          <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-muted">
            <MapPin className="mt-px h-2.5 w-2.5 shrink-0" />
            <span className="line-clamp-1">{shop.address.split(",")[0].trim()}</span>
          </p>
        )}

        {/* mt-auto pins the wait to the bottom, so a shop with a short name and
            one with a long one still line their pills up across a rail. */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          {waitMin != null ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold",
                byAppointment
                  ? "bg-accent/10 text-accent"
                  : waitMin === 0
                    ? "bg-good-soft text-good"
                    : "bg-live-soft text-live",
              )}
            >
              <Clock3 className="h-2.5 w-2.5" />
              {byAppointment
                ? t("byAppointmentPill")
                : waitMin === 0
                  ? t("walkInNow")
                  : t("waitMinutes", waitMin)}
            </span>
          ) : (
            <span />
          )}
          <ArrowUpRight
            aria-hidden
            className="h-4 w-4 shrink-0 text-muted/50 transition-colors group-hover:text-accent"
          />
        </div>
      </div>
    </Link>
  );
}
