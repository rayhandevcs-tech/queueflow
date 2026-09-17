"use client";

import dynamic from "next/dynamic";
import { MapPinOff } from "lucide-react";
import type { Shop } from "@/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

/**
 * The map's own footprint, used by both loading states and by the live map, so
 * the page doesn't jump by a hundred pixels when tiles finish arriving.
 */
const MAP_FRAME = "h-[26rem] w-full sm:h-[30rem]";

function MapSkeleton() {
  return (
    <div
      className={cn(
        MAP_FRAME,
        "grid place-items-center overflow-hidden rounded-3xl border border-line",
        "bg-[linear-gradient(135deg,var(--color-soft),var(--color-card))] shadow-sm",
      )}
    >
      <Spinner className="h-6 w-6 text-muted" />
    </div>
  );
}

const ShopMapInner = dynamic(() => import("./ShopMapInner"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

export function ShopMap({
  shops,
  counts,
  waitMin,
  distanceKm,
  ratingByShopId,
  userLocation,
  isPending,
}: {
  shops: Shop[] | undefined;
  counts: Record<string, number>;
  waitMin: Record<string, number>;
  distanceKm?: Record<string, number>;
  ratingByShopId?: Map<string, { avg_rating: number; review_count: number }>;
  userLocation?: { lat: number; lng: number } | null;
  isPending: boolean;
}) {
  const t = useT(customerExploreDict);

  if (isPending) return <MapSkeleton />;

  const all = shops ?? [];
  const located = all.filter(
    (s): s is typeof s & { latitude: number; longitude: number } =>
      s.latitude != null && s.longitude != null,
  );
  /**
   * Shops the map cannot draw, because their owner never set a location.
   *
   * These used to disappear without a word: the list showed eight shops, the
   * map showed five, and nothing on the screen accounted for the other three.
   * A map can only be honest about what it leaves out, so it says so and
   * points at the list, which has all of them.
   */
  const unplaced = all.length - located.length;

  if (!located.length) {
    return (
      <EmptyState
        icon={<MapPinOff className="h-6 w-6" />}
        title={t("noShopLocations")}
        description={t("noShopLocationsDesc")}
      />
    );
  }

  return (
    // rounded-3xl to match Card, plus an inner hairline: tiles run edge to
    // edge under the border, and without it the map's own colours touch the
    // page background directly and the frame stops reading as a surface.
    <>
    {unplaced > 0 && (
      <p className="mb-2.5 flex items-start gap-1.5 rounded-xl bg-soft px-3 py-2 text-[12px] leading-snug text-muted">
        <MapPinOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t("unplacedShopsNote", unplaced)}
      </p>
    )}
    <div className="relative overflow-hidden rounded-3xl border border-line shadow-sm">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1001] rounded-3xl ring-1 ring-ink/5 ring-inset"
      />
      <ShopMapInner
        shops={located}
        counts={counts}
        waitMin={waitMin}
        distanceKm={distanceKm}
        ratingByShopId={ratingByShopId}
        userLocation={userLocation}
      />
    </div>
    </>
  );
}
