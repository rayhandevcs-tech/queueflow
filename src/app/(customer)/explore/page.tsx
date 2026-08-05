"use client";

import { useMemo, useState } from "react";
import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import {
  useOpenShops,
  useShopLiveStats,
} from "@/features/customer-explore/hooks/use-open-shops";
import { useUserLocation } from "@/features/customer-explore/hooks/use-user-location";
import { useActiveOffers } from "@/features/customer-explore/hooks/use-offers";
import { useShopRatings } from "@/features/customer-explore/hooks/use-ratings";
import { useServiceCategories } from "@/features/customer-explore/hooks/use-service-categories";
import { ActiveBookingBanner } from "@/features/customer-booking/components/ActiveBookingBanner";
import { ExploreView } from "@/features/customer-explore/components/ExploreView";
import { LocationPrompt } from "@/features/customer-explore/components/LocationPrompt";
import { OfferCarousel } from "@/features/customer-explore/components/OfferCarousel";
import { CategoryShortcutRow } from "@/features/customer-explore/components/CategoryShortcutRow";
import { TopRatedSection } from "@/features/customer-explore/components/TopRatedSection";
import { SearchFilterBar } from "@/features/customer-explore/components/SearchFilterBar";
import {
  DEFAULT_FILTERS,
  FilterSheet,
  hasActiveFilters,
  type ShopFilters,
} from "@/features/customer-explore/components/FilterSheet";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { distanceKm as computeDistanceKm } from "@/lib/geo";
import type { SelectableBusinessType, ServiceCategory } from "@/config/constants";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "@/features/customer-explore/lib/i18n";

export default function ExplorePage() {
  const { data: profile } = useMyProfile();
  const t = useT(customerExploreDict);
  const { data: shops, isPending: shopsPending } = useOpenShops();
  const { counts, waitMin, isPending: statsPending } = useShopLiveStats();
  const location = useUserLocation();
  const { data: offers } = useActiveOffers();
  const { byShopId: ratingByShopId } = useShopRatings();
  const { categoriesByShopId, serviceNamesByShopId, presentCategories } = useServiceCategories();

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<ServiceCategory | null>(null);
  const [filters, setFilters] = useState<ShopFilters>(DEFAULT_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const distanceKm = useMemo(() => {
    if (!shops || !location.coords) return {};
    const { lat, lng } = location.coords;
    const result: Record<string, number> = {};
    for (const shop of shops) {
      if (shop.latitude == null || shop.longitude == null) continue;
      result[shop.id] = computeDistanceKm(lat, lng, shop.latitude, shop.longitude);
    }
    return result;
  }, [shops, location.coords]);

  const sortedShops = useMemo(() => {
    if (!shops || !location.coords) return shops;
    return [...shops].sort((a, b) => {
      const da = distanceKm[a.id] ?? Infinity;
      const db = distanceKm[b.id] ?? Infinity;
      return da - db;
    });
  }, [shops, distanceKm, location.coords]);

  const filteredShops = useMemo(() => {
    let list = sortedShops ?? [];

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (shop) =>
          shop.name.toLowerCase().includes(q) ||
          (serviceNamesByShopId.get(shop.id) ?? []).some((name) => name.toLowerCase().includes(q)),
      );
    }

    if (activeCategory) {
      list = list.filter((shop) => categoriesByShopId.get(shop.id)?.has(activeCategory));
    }

    if (filters.types.size > 0) {
      list = list.filter((shop) => filters.types.has(shop.business_type as SelectableBusinessType));
    }

    if (filters.minRating > 0) {
      list = list.filter((shop) => (ratingByShopId.get(shop.id)?.avg_rating ?? 0) >= filters.minRating);
    }

    if (filters.maxDistanceKm != null) {
      list = list.filter((shop) => (distanceKm[shop.id] ?? Infinity) <= filters.maxDistanceKm!);
    }

    return list;
  }, [
    sortedShops,
    search,
    activeCategory,
    filters,
    serviceNamesByShopId,
    categoriesByShopId,
    ratingByShopId,
    distanceKm,
  ]);

  const openShopCount = shops?.length ?? 0;
  const waits = Object.values(waitMin);
  const minWait = waits.length ? Math.min(...waits) : 0;

  return (
    <div className="animate-fade-up">
      <SearchFilterBar
        value={search}
        onChange={setSearch}
        onOpenFilters={() => setFilterSheetOpen(true)}
        filtersActive={hasActiveFilters(filters)}
      />

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted">{t("assalamu")}</p>
          <h1 className="mt-0.5 font-display text-[25px] font-bold leading-tight text-ink">
            {t("nearbySalonsHeading")}
          </h1>
        </div>
        <AvatarChip label={profile?.full_name} avatarUrl={profile?.avatar_url} />
      </div>

      <ActiveBookingBanner />

      <div className="mb-4 flex gap-2.5">
        <div className="flex-1 rounded-[13px] border border-line bg-soft p-3">
          <p className="font-number text-[19px] font-bold text-ink">{openShopCount}</p>
          <p className="text-[11px] text-muted">{t("openShopsLabel")}</p>
        </div>
        <div className="flex-1 rounded-[13px] border border-line bg-soft p-3">
          <p className="font-number text-[19px] font-bold text-ink">
            ~{minWait}
            <span className="text-xs">{t("minUnit")}</span>
          </p>
          <p className="text-[11px] text-muted">{t("lowestWaitLabel")}</p>
        </div>
      </div>

      <div className="mb-4">
        <LocationPrompt
          status={location.status}
          error={location.error}
          onRequest={location.requestLocation}
          onManualPick={location.setManualLocation}
        />
      </div>

      <OfferCarousel offers={offers} />

      <CategoryShortcutRow
        categories={presentCategories}
        active={activeCategory}
        onSelect={setActiveCategory}
      />

      <p className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">
        {t("nearbyShopsHeading")}
      </p>

      <ExploreView
        shops={filteredShops}
        counts={counts}
        waitMin={waitMin}
        distanceKm={distanceKm}
        userLocation={location.coords}
        isPending={shopsPending || statsPending}
      />

      <div className="mt-5">
        <TopRatedSection shops={shops} ratingByShopId={ratingByShopId} />
      </div>

      <FilterSheet
        open={filterSheetOpen}
        initial={filters}
        hasLocation={!!location.coords}
        onApply={setFilters}
        onClose={() => setFilterSheetOpen(false)}
      />
    </div>
  );
}
