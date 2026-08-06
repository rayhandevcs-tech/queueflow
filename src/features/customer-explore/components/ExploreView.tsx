"use client";

import { useState } from "react";
import { MapIcon, List } from "lucide-react";
import type { Shop } from "@/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";
import { ShopList } from "./ShopList";
import { ShopMap } from "./ShopMap";
import { FirstRunSheet } from "./FirstRunSheet";

export function ExploreView({
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
  const [view, setView] = useState<"map" | "list">("map");
  const t = useT(customerExploreDict);

  return (
    <div className="space-y-4">
      <FirstRunSheet />

      <div className="inline-flex gap-1 rounded-xl border border-line bg-card p-1 shadow-xs">
        <button
          type="button"
          onClick={() => setView("map")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all",
            view === "map"
              ? "bg-accent text-accent-ink shadow-sm"
              : "text-muted hover:text-ink",
          )}
        >
          <MapIcon className="h-4 w-4" />
          {t("mapView")}
        </button>
        <button
          type="button"
          onClick={() => setView("list")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-all",
            view === "list"
              ? "bg-accent text-accent-ink shadow-sm"
              : "text-muted hover:text-ink",
          )}
        >
          <List className="h-4 w-4" />
          {t("listView")}
        </button>
      </div>

      {view === "map" ? (
        <ShopMap
          shops={shops}
          counts={counts}
          waitMin={waitMin}
          userLocation={userLocation}
          isPending={isPending}
        />
      ) : (
        <ShopList
          shops={shops}
          counts={counts}
          waitMin={waitMin}
          distanceKm={distanceKm}
          ratingByShopId={ratingByShopId}
          isPending={isPending}
        />
      )}
    </div>
  );
}
