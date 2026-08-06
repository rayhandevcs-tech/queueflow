"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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

  // Live GPS wins when granted; otherwise fall back to the customer's saved
  // profile address (Sprint 22) so distance-sort/badges still work without
  // asking for location every visit. Cheap comparison, no memo needed.
  const effectiveLocation =
    location.coords ??
    (profile?.address_lat != null && profile?.address_lng != null
      ? { lat: profile.address_lat, lng: profile.address_lng }
      : null);

  const distanceKm = useMemo(() => {
    if (!shops || !effectiveLocation) return {};
    const { lat, lng } = effectiveLocation;
    const result: Record<string, number> = {};
    for (const shop of shops) {
      if (shop.latitude == null || shop.longitude == null) continue;
      result[shop.id] = computeDistanceKm(lat, lng, shop.latitude, shop.longitude);
    }
    return result;
  }, [shops, effectiveLocation]);

  const sortedShops = useMemo(() => {
    if (!shops || !effectiveLocation) return shops;
    return [...shops].sort((a, b) => {
      const da = distanceKm[a.id] ?? Infinity;
      const db = distanceKm[b.id] ?? Infinity;
      return da - db;
    });
  }, [shops, distanceKm, effectiveLocation]);

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

  const firstName = (profile?.full_name ?? "").trim().split(" ")[0] || null;

  return (
    <div className="animate-fade-up">
      {/* Greeting first, search second: the header establishes who this is and
          what the screen is for before offering a tool to narrow it down. */}
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] text-muted">
            {firstName ? t("greetingNamed", firstName) : t("assalamu")}
          </p>
          <h1 className="mt-0.5 font-display text-[26px] leading-tight font-bold tracking-tight text-ink">
            {t("nearbySalonsHeading")}
          </h1>
        </div>
        <Link href="/profile" className="shrink-0" aria-label={t("openProfileAria")}>
          <AvatarChip label={profile?.full_name} avatarUrl={profile?.avatar_url} size={44} />
        </Link>
      </header>

      <ActiveBookingBanner />

      {/* One dark stat block instead of two pale boxes: the two numbers that
          decide whether it's worth going out belong together, and the contrast
          makes them the first thing read on the page. */}
      <div className="mb-4 flex items-stretch gap-px overflow-hidden rounded-[18px] bg-ink text-white">
        <div className="flex-1 px-4 py-3.5">
          <p className="font-number text-[26px] leading-none font-extrabold">{openShopCount}</p>
          <p className="mt-1.5 text-[11px] text-white/55">{t("openShopsLabel")}</p>
        </div>
        <div className="w-px bg-white/10" />
        <div className="flex-1 px-4 py-3.5">
          <p className="font-number text-[26px] leading-none font-extrabold text-brass">
            ~{minWait}
            <span className="ml-0.5 text-sm font-bold">{t("minUnit")}</span>
          </p>
          <p className="mt-1.5 text-[11px] text-white/55">{t("lowestWaitLabel")}</p>
        </div>
      </div>

      <SearchFilterBar
        value={search}
        onChange={setSearch}
        onOpenFilters={() => setFilterSheetOpen(true)}
        filtersActive={hasActiveFilters(filters)}
      />

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
        ratingByShopId={ratingByShopId}
        userLocation={effectiveLocation}
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
