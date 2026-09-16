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
import { StyleStudioBanner } from "@/features/customer-style/components/StyleStudioBanner";
import { SearchFilterBar } from "@/features/customer-explore/components/SearchFilterBar";
import {
  BusinessTypeFilterRow,
  matchesTypeFilter,
  type BusinessTypeFilter,
} from "@/features/customer-explore/components/BusinessTypeFilterRow";
import {
  DEFAULT_FILTERS,
  FilterSheet,
  hasActiveFilters,
  type ShopFilters,
} from "@/features/customer-explore/components/FilterSheet";
import { AvatarChip } from "@/components/ui/AvatarChip";
import {
  usePreferredExperience,
  useSetPreferredExperience,
} from "@/features/account/hooks/use-preferred-experience";
import { EcosystemPicker } from "@/features/customer-explore/components/EcosystemPicker";
import {
  effectiveTypeFilter,
  filterByPreference,
  sortByPreference,
} from "@/lib/customer-preference";
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

  const { preference, isPending: preferencePending } = usePreferredExperience();
  const setPreference = useSetPreferredExperience();

  // `null` means "the customer has not touched the chips", which is different
  // from them having chosen "All" — and the difference matters, because the
  // preference should decide the view right up until they say otherwise and
  // never again after. Deriving the effective filter instead of seeding state
  // from `preference` also avoids the effect that would otherwise be needed
  // to wait for the profile to load (and which `react-hooks/set-state-in-effect`
  // would rightly complain about).
  const [typeChoice, setTypeChoice] = useState<BusinessTypeFilter | null>(null);
  const typeFilter: BusinessTypeFilter = effectiveTypeFilter(typeChoice, preference);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<ServiceCategory | null>(null);
  const [filters, setFilters] = useState<ShopFilters>(DEFAULT_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  /**
   * **The ecosystem gate. Everything below this line sees only these shops.**
   *
   * A customer who registered for salon service gets a salon app: the list,
   * the map, the rails, the counts and the category shortcuts are all built
   * from this array, so a parlour cannot appear in any of them. A parlour
   * customer gets the mirror image.
   *
   * Applied once, here, rather than at each of the five places that render a
   * shop — that is the difference between a rule and five chances to forget
   * it. `filterByPreference` matches on booking MODEL, so a unisex shop lands
   * with the salons exactly as `bookingModel()` has always said it should.
   *
   * A legacy account with no preference, and every guest, sees everything —
   * there is no ecosystem to narrow to. Those customers get the picker below
   * instead of being left on a mixed list.
   */
  const ecosystemShops = useMemo(
    () => filterByPreference(shops ?? [], preference),
    [shops, preference],
  );
  /** Once they have chosen, the type chips have nothing left to choose from. */
  const lockedToEcosystem = !!preference;

  // Live GPS wins when granted; otherwise fall back to the customer's saved
  // profile address (Sprint 22) so distance-sort/badges still work without
  // asking for location every visit. Cheap comparison, no memo needed.
  const effectiveLocation =
    location.coords ??
    (profile?.address_lat != null && profile?.address_lng != null
      ? { lat: profile.address_lat, lng: profile.address_lng }
      : null);

  const distanceKm = useMemo(() => {
    if (!effectiveLocation) return {};
    const { lat, lng } = effectiveLocation;
    const result: Record<string, number> = {};
    for (const shop of ecosystemShops) {
      if (shop.latitude == null || shop.longitude == null) continue;
      result[shop.id] = computeDistanceKm(lat, lng, shop.latitude, shop.longitude);
    }
    return result;
  }, [ecosystemShops, effectiveLocation]);

  const sortedShops = useMemo(() => {
    // Distance only. Sorting by preference used to happen here too, but once
    // the list is already one ecosystem there is nothing left to sort to the
    // top — every row matches. It is still applied for the no-preference case,
    // where the list really is mixed.
    const byDistance = effectiveLocation
      ? [...ecosystemShops].sort((a, b) => {
          const da = distanceKm[a.id] ?? Infinity;
          const db = distanceKm[b.id] ?? Infinity;
          return da - db;
        })
      : ecosystemShops;
    return lockedToEcosystem ? byDistance : sortByPreference(byDistance, preference);
  }, [ecosystemShops, distanceKm, effectiveLocation, preference, lockedToEcosystem]);

  // Counted before any filtering, so "Salon 3" means three salons exist —
  // not three that survive whatever else is switched on.
  const typeCounts = useMemo(() => {
    const all = ecosystemShops;
    return {
      ALL: all.length,
      SALON: all.filter((shop) => matchesTypeFilter(shop.business_type, "SALON")).length,
      PARLOUR: all.filter((shop) => matchesTypeFilter(shop.business_type, "PARLOUR")).length,
    };
  }, [ecosystemShops]);

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

    // `?? false` covers the window where the deploy is ahead of the migration:
    // an unknown flag reads as "not women-only" rather than hiding every shop.
    if (filters.womenOnly) {
      list = list.filter((shop) => (shop.women_only ?? false) === true);
    }

    // The customer's own tap, never their stored preference.
    if (typeFilter !== "ALL") {
      list = list.filter((shop) => matchesTypeFilter(shop.business_type, typeFilter));
    }

    return list;
  }, [
    typeFilter,
    sortedShops,
    search,
    activeCategory,
    filters,
    serviceNamesByShopId,
    categoriesByShopId,
    ratingByShopId,
    distanceKm,
  ]);

  // Used by the rails below, which are not subject to the type filter.
  // The rails are inside the ecosystem too. A "top rated" list that surfaced
  // the other kind of business would reintroduce exactly what the gate is for.
  const railShops = useMemo(
    () => (lockedToEcosystem ? ecosystemShops : sortByPreference(ecosystemShops, preference)),
    [ecosystemShops, preference, lockedToEcosystem],
  );

  /**
   * Category chips for the shops actually on screen. `presentCategories` is
   * computed across the whole platform, so before the gate a salon customer
   * was being offered "Facial" and "Nail" — categories no shop they can see
   * offers. Tapping one emptied the list.
   */
  const ecosystemCategories = useMemo(() => {
    if (!lockedToEcosystem) return presentCategories;
    const present = new Set<ServiceCategory>();
    for (const shop of ecosystemShops) {
      for (const category of categoriesByShopId.get(shop.id) ?? []) present.add(category);
    }
    return new Set([...presentCategories].filter((category) => present.has(category)));
  }, [presentCategories, ecosystemShops, categoriesByShopId, lockedToEcosystem]);

  return (
    <div className="animate-fade-up">
      {/* The welcome panel that used to sit here — greeting, headline,
          subtitle, and two stat tiles — took most of the first screen to say
          things the rest of the page says better. "2 খোলা দোকান" is the list
          right below it, and "সবচেয়ে কম ওয়েট" read "~0মি" more often than
          anything else, which is worse than silent. What is left is a line
          that names you and gets out of the way. */}
      <header className="mb-4 flex items-center justify-between gap-3">
        <h1 className="min-w-0 truncate font-display text-[22px] leading-tight font-bold text-ink">
          {t("heroHeadline")}
        </h1>
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

      {/* Only for an account that can save an answer, and only once there is
          an answer to save — `preferencePending` avoids flashing the card at
          somebody who has a preference the profile query has not returned
          yet. */}
      {signedIn && !preference && !preferencePending && (
        <EcosystemPicker
          isSaving={setPreference.isPending}
          onChoose={setPreference.setPreference}
        />
      )}

      <SearchFilterBar
        value={search}
        onChange={setSearch}
        onOpenFilters={() => setFilterSheetOpen(true)}
        filtersActive={hasActiveFilters(filters)}
      />

      {/* Hidden once an ecosystem is chosen. With the list already narrowed to
          one kind, "All / Salon / Parlour" would offer two choices that return
          nothing and one that changes nothing — a control that lies about what
          it does is worse than no control. Legacy accounts and guests still
          get it, because for them the list genuinely is mixed. */}
      {!lockedToEcosystem && (
        <div className="mb-3">
          <BusinessTypeFilterRow
            value={typeFilter}
            onChange={setTypeChoice}
            counts={typeCounts}
          />
        </div>
      )}

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
        categories={ecosystemCategories}
        active={activeCategory}
        onSelect={setActiveCategory}
      />

      <p className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">
        {/* Named after what the list is actually showing. "Nearby shops" over
            a list of only parlours is a small lie that makes the filter above
            look broken. */}
        {/* Driven by the ecosystem once one is chosen, and by the chips
            otherwise. "Nearby shops" over a list of only parlours is a small
            lie that makes the screen look broken. */}
        {typeFilter === "SALON"
          ? t("nearbySalonHeading")
          : typeFilter === "PARLOUR"
            ? t("nearbyParlourHeading")
            : t("nearbyShopsHeading")}
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
        {/* Signed-in only: the studio's whole point is telling your shop what
            you want, which needs an account. */}
        {signedIn && (
          <div className="mb-5">
            <StyleStudioBanner />
          </div>
        )}
        {/* The rails stay cross-type — a great parlour is worth seeing even if
            you came for a haircut — but they LEAD with the customer's own
            ecosystem. `sortByPreference` reorders and provably drops nothing,
            so this changes which card is first and not which cards exist. */}
        <TopRatedSection
          shops={railShops}
          ratingByShopId={ratingByShopId}
          waitMin={waitMin}
        />
        {signedIn && (
          <FavouriteShopsSection
            shops={railShops}
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
