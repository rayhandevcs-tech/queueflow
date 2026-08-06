"use client";

import Link from "next/link";
import { MapPin, Star, Store } from "lucide-react";
import type { Shop } from "@/types";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import { EmptyState } from "@/components/ui/EmptyState";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { useAuthGate } from "@/components/auth/AuthGate";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { shopAvailability } from "@/lib/shop-availability";
import { cn } from "@/lib/utils";
import { useMyFavoriteShopIds, useToggleFavorite } from "../hooks/use-favorites";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

const WAIT_OK_THRESHOLD_MIN = 40;

export function ShopList({
  shops,
  counts,
  waitMin,
  distanceKm,
  ratingByShopId,
  isPending,
}: {
  shops: Shop[] | undefined;
  counts: Record<string, number>;
  waitMin: Record<string, number>;
  distanceKm?: Record<string, number>;
  ratingByShopId?: Map<string, { avg_rating: number; review_count: number }>;
  isPending: boolean;
}) {
  const { data: favoriteIds } = useMyFavoriteShopIds();
  const toggleFavorite = useToggleFavorite();
  const { guard } = useAuthGate();
  const t = useT(customerExploreDict);
  const businessTypeT = useT(BUSINESS_TYPE_LABEL);

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-[18px] border border-line bg-card" />
        ))}
      </div>
    );
  }

  if (!shops?.length) {
    return (
      <EmptyState
        icon={<Store className="h-6 w-6" />}
        title={t("noOpenShops")}
        description={t("noOpenShopsDesc")}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {shops.map((shop) => {
        const queue = counts[shop.id] ?? 0;
        const wait = waitMin[shop.id] ?? 0;
        const waitOk = wait <= WAIT_OK_THRESHOLD_MIN;
        const distance = distanceKm?.[shop.id];
        const availability = shopAvailability(shop);
        const rating = ratingByShopId?.get(shop.id);

        return (
          <li key={shop.id} className="relative">
            <Link
              href={`/explore/${shop.id}`}
              className="group block overflow-hidden rounded-[18px] border border-line bg-card transition-all duration-150 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md"
            >
              <div className="flex gap-3.5 p-3.5">
                <div
                  className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl font-display text-2xl font-extrabold text-white"
                  style={{ background: shopAvatarColor(shop.id) }}
                >
                  {shop.cover_image_url || shop.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={shop.logo_url ?? shop.cover_image_url ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    shopInitial(shop.name)
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Name and rating on one line: the two things that decide
                      whether this card gets read any further. */}
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 truncate font-display text-[17px] leading-tight font-bold text-ink">
                      {shop.name}
                    </p>
                    {rating && rating.review_count > 0 && (
                      <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-brass-soft px-2 py-0.5 text-[11px] font-bold text-brass">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        {rating.avg_rating}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                    <span className="shrink-0 font-semibold text-accent">
                      {businessTypeT(shop.business_type)}
                    </span>
                    {shop.address && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="flex min-w-0 items-center gap-0.5 truncate">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{shop.address}</span>
                        </span>
                      </>
                    )}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {/* The wait leads — it's the number that decides the trip. */}
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-bold",
                        waitOk
                          ? "bg-good-soft text-good"
                          : "bg-live-soft text-live",
                      )}
                    >
                      ~<span className="font-number">{wait}</span> {t("minWait")}
                    </span>
                    <span className="rounded-full bg-soft px-2.5 py-1 text-[11px] text-muted">
                      {t("runningPrefix")} <b className="font-number text-ink">{queue}</b>
                    </span>
                    {distance != null && (
                      <span className="rounded-full bg-soft px-2.5 py-1 text-[11px] text-muted">
                        <span className="font-number text-ink">{distance.toFixed(1)}</span>{" "}
                        {t("km")}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* A shop that can't take you is still worth showing, but the
                  card has to say so before the tap, not after. */}
              {availability === "NOT_ACCEPTING" && (
                <p className="bg-live-soft px-3.5 py-1.5 text-[11px] font-semibold text-live">
                  {t("notAcceptingPill")}
                </p>
              )}
              {availability === "BREAK" && (
                <p className="bg-brass-soft px-3.5 py-1.5 text-[11px] font-semibold text-brass">
                  {t("breakPill")}
                </p>
              )}
            </Link>

            {/* Outside the anchor — a button nested in a link is the bug this
                codebase already fixed once in the provider sidebar. */}
            <div className="absolute top-3.5 right-3.5">
              <FavoriteButton
                isFavorited={favoriteIds?.has(shop.id) ?? false}
                pending={toggleFavorite.isPending}
                onToggle={guard(() =>
                  toggleFavorite.mutate({
                    shopId: shop.id,
                    isFavorited: favoriteIds?.has(shop.id) ?? false,
                  }),
                )}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
