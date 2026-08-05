"use client";

import Link from "next/link";
import { ChevronRight, MapPin, Store } from "lucide-react";
import type { Shop } from "@/types";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import { EmptyState } from "@/components/ui/EmptyState";
import { FavoriteButton } from "@/components/ui/FavoriteButton";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { shopAvailability } from "@/lib/shop-availability";
import { useMyFavoriteShopIds, useToggleFavorite } from "../hooks/use-favorites";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

const WAIT_OK_THRESHOLD_MIN = 40;

export function ShopList({
  shops,
  counts,
  waitMin,
  distanceKm,
  isPending,
}: {
  shops: Shop[] | undefined;
  counts: Record<string, number>;
  waitMin: Record<string, number>;
  distanceKm?: Record<string, number>;
  isPending: boolean;
}) {
  const { data: favoriteIds } = useMyFavoriteShopIds();
  const toggleFavorite = useToggleFavorite();
  const t = useT(customerExploreDict);
  const businessTypeT = useT(BUSINESS_TYPE_LABEL);

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-[18px] border border-line bg-card" />
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

        return (
          <li key={shop.id}>
            <Link
              href={`/explore/${shop.id}`}
              className="group flex items-center gap-3.5 rounded-[18px] border border-line bg-card p-3.5 shadow-[0_1px_0_var(--color-line)] transition-transform duration-150 hover:-translate-y-0.5 hover:border-accent"
            >
              <div
                className="grid h-13.5 w-13.5 shrink-0 place-items-center overflow-hidden rounded-2xl font-display text-xl font-extrabold text-white"
                style={{ background: shopAvatarColor(shop.id) }}
              >
                {shop.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shop.cover_image_url}
                    alt={shop.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  shopInitial(shop.name)
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-bold text-ink">{shop.name}</p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <span className="font-medium text-accent">
                    {businessTypeT(shop.business_type)}
                  </span>
                  {shop.address && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="flex min-w-0 items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{shop.address}</span>
                      </span>
                    </>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="rounded-full border border-line bg-soft px-2.5 py-1 text-[11px] text-ink">
                    {t("runningPrefix")} <b className="font-number">{queue}</b> {t("serialSuffix")}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{
                      color: waitOk ? "var(--color-good)" : "var(--color-live)",
                      background: waitOk ? "var(--color-good-soft)" : "var(--color-live-soft)",
                    }}
                  >
                    ~<span className="font-number">{wait}</span> {t("minWait")}
                  </span>
                  {distance != null && (
                    <span className="rounded-full border border-line bg-soft px-2.5 py-1 text-[11px] text-ink">
                      ~<span className="font-number">{distance.toFixed(1)}</span> {t("km")}
                    </span>
                  )}
                  {/* A shop that stopped taking new serials, or is on a break,
                      is still open and still worth showing — but the customer
                      needs to know before they tap in. */}
                  {availability === "NOT_ACCEPTING" && (
                    <span className="rounded-full bg-live-soft px-2.5 py-1 text-[11px] font-semibold text-live">
                      {t("notAcceptingPill")}
                    </span>
                  )}
                  {availability === "BREAK" && (
                    <span className="rounded-full bg-brass-soft px-2.5 py-1 text-[11px] font-semibold text-brass">
                      {t("breakPill")}
                    </span>
                  )}
                </div>
              </div>

              <FavoriteButton
                isFavorited={favoriteIds?.has(shop.id) ?? false}
                pending={toggleFavorite.isPending}
                onToggle={() =>
                  toggleFavorite.mutate({ shopId: shop.id, isFavorited: favoriteIds?.has(shop.id) ?? false })
                }
              />

              <ChevronRight className="h-5 w-5 shrink-0 text-line transition-colors group-hover:text-accent" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
