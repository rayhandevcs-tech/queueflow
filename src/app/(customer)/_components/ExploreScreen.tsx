"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import { useAuthGate } from "@/components/auth/AuthGate";
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

/**
 * The explore screen, shared by the signed-in customer home (/explore) and the
 * guest landing page (/).
 *
 * One composition rather than two: a guest and a customer are looking at the
 * same catalogue, and forking it would guarantee the two drift. What differs
 * is only what belongs to an account — the greeting by name, the profile
 * avatar, the active-booking banner, the favourites rail — and each of those
 * is dropped rather than shown empty.
 */
export function ExploreScreen() {
  const { signedIn } = useAuthGate();
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

  const firstName = (profile?.full_name ?? "").trim().split(" ")[0] || null;

  return (
    <div className="animate-fade-up">
      {/* The welcome panel that used to sit here — greeting, headline,
          subtitle, and two stat tiles — took most of the first screen to say
          things the rest of the page says better. "2 খোলা দোকান" is the list
          right below it, and "সবচেয়ে কম ওয়েট" read "~0মি" more often than
          anything else, which is worse than silent. What is left is a line
          that names you and gets out of the way. */}
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] text-muted">
            {firstName ? t("greetingNamed", firstName) : t("assalamu")}
          </p>
          <h1 className="mt-0.5 truncate font-display text-[22px] leading-tight font-bold text-ink">
            {t("heroHeadline")}
          </h1>
        </div>
        {signedIn && (
          <Link href="/profile" className="shrink-0" aria-label={t("openProfileAria")}>
            <AvatarChip label={profile?.full_name} avatarUrl={profile?.avatar_url} size={42} />
          </Link>
        )}
      </header>

      {/* Both belong to an account: a guest has no booking to resume and no
          favourites to show, so they are absent rather than empty. In their
          place a guest gets one honest line about where they stand — the point
          is that nobody should have to work out whether they are signed in. */}
      {signedIn ? (
        <ActiveBookingBanner />
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-dashed border-line bg-soft px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-ink">{t("guestBadge")}</p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted">{t("guestBannerBody")}</p>
          </div>
          <Link
            href="/register"
            className="shrink-0 rounded-[14px] bg-accent px-3.5 py-2 text-[13px] font-bold text-accent-ink hover:opacity-90"
          >
            {t("guestBannerCta")}
          </Link>
        </div>
      )}

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
        {signedIn && (
          <FavouriteShopsSection
            shops={shops}
            ratingByShopId={ratingByShopId}
            waitMin={waitMin}
          />
        )}
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
