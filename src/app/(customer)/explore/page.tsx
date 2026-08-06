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
import { FavouriteShopsSection } from "@/features/customer-explore/components/FavouriteShopsSection";
import { SearchFilterBar } from "@/features/customer-explore/components/SearchFilterBar";
import {
  DEFAULT_FILTERS,
  FilterSheet,
  hasActiveFilters,
  type ShopFilters,
} from "@/features/customer-explore/components/FilterSheet";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { distanceKm as computeDistanceKm } from "@/lib/geo";
import type { ServiceCategory } from "@/config/constants";
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
      {/* A welcome panel rather than a line of text: this is the first thing
          seen on opening the app, and it should establish where you are and
          what the screen is for before offering a search box. */}
      <header className="relative mb-4 overflow-hidden rounded-[24px] border border-line bg-gradient-to-br from-accent/[0.09] via-card to-brass/[0.07] px-5 py-5 shadow-sm">
        <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-muted">
              {firstName ? t("greetingNamed", firstName) : t("assalamu")}
            </p>
            <h1 className="mt-1 font-display text-[27px] leading-[1.15] font-bold tracking-tight text-ink">
              {t("heroHeadline")}
            </h1>
            <p className="mt-1.5 text-[13px] leading-snug text-muted">
              {t("heroSubtitle")}
            </p>
          </div>
          <Link href="/profile" className="shrink-0" aria-label={t("openProfileAria")}>
            <AvatarChip label={profile?.full_name} avatarUrl={profile?.avatar_url} size={46} />
          </Link>
        </div>

        {/* The two numbers that decide whether it's worth going out, inside
            the same panel — they're the answer to the subtitle's question. */}
        <div className="relative mt-4 flex items-stretch overflow-hidden rounded-2xl border border-line bg-card/80 backdrop-blur-sm">
          <div className="flex-1 px-4 py-3">
            <p className="font-number text-[24px] leading-none font-extrabold tabular-nums text-ink">
              {openShopCount}
            </p>
            <p className="mt-1.5 text-[11px] font-medium text-muted">{t("openShopsLabel")}</p>
          </div>
          <div className="my-3 w-px bg-line" />
          <div className="flex-1 px-4 py-3">
            <p className="font-number text-[24px] leading-none font-extrabold tabular-nums text-accent">
              ~{minWait}
              <span className="ml-0.5 text-sm font-bold">{t("minUnit")}</span>
            </p>
            <p className="mt-1.5 text-[11px] font-medium text-muted">{t("lowestWaitLabel")}</p>
          </div>
        </div>
      </header>

      <ActiveBookingBanner />

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

      <div className="mt-6">
        <TopRatedSection shops={shops} ratingByShopId={ratingByShopId} waitMin={waitMin} />
        <FavouriteShopsSection
          shops={shops}
          ratingByShopId={ratingByShopId}
          waitMin={waitMin}
        />
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
