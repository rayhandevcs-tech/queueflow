"use client";

import dynamic from "next/dynamic";
import { MapPinOff } from "lucide-react";
import type { Shop } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

const ShopMapInner = dynamic(() => import("./ShopMapInner"), {
  ssr: false,
  loading: () => (
    <div className="grid h-110 w-full place-items-center rounded-2xl border border-line bg-card shadow-sm">
      <Spinner className="h-6 w-6 text-muted" />
    </div>
  ),
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

  if (isPending) {
    return (
      <div className="grid h-110 w-full place-items-center rounded-2xl border border-line bg-card shadow-sm">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  const located = (shops ?? []).filter(
    (s): s is typeof s & { latitude: number; longitude: number } =>
      s.latitude != null && s.longitude != null,
  );

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
    <div className="overflow-hidden rounded-2xl border border-line shadow-sm">
      <ShopMapInner
        shops={located}
        counts={counts}
        waitMin={waitMin}
        distanceKm={distanceKm}
        ratingByShopId={ratingByShopId}
        userLocation={userLocation}
      />
    </div>
  );
}
