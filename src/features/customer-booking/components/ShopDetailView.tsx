"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock3, MessageCircle, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";
import { chairFreeAtMs, minutesUntil } from "@/lib/queue-wait";
import { readRememberedLocation } from "@/lib/last-location";
import { estimateTravelMin } from "@/lib/travel";
import { breakMinutesLeft, canBookNow, shopAvailability } from "@/lib/shop-availability";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { TabBar } from "@/components/ui/TabBar";
import { useToast } from "@/components/ui/Toast";
import { useLanguage, useT } from "@/lib/i18n";
import { useTerms } from "@/lib/business-terms";
import { customerBookingDict } from "../lib/i18n";
import {
  useChairCapabilities,
  useHasShopHistory,
  useShopChairs,
  useChairRatings,
  useShopDetail,
  useShopServices,
} from "../hooks/use-shop-detail";
import { useShopReviewsPublic } from "../hooks/use-shop-reviews-public";
import { useAuthGate } from "@/components/auth/AuthGate";
import { useMyActiveSerial, useShopQueuePublic } from "../hooks/use-my-serial";
import { useCreateBooking, useCreateGroupBooking } from "../hooks/use-booking-mutations";
import { AdvancePaymentDialog } from "./AdvancePaymentDialog";
import { PartySection, type PartyGuest } from "./PartySection";
import { ShopHero } from "./ShopHero";
import { ShopQuickActions } from "./ShopQuickActions";
import { ServicesTab } from "./ServicesTab";
import { StaffTab } from "./StaffTab";
import { GalleryTab } from "./GalleryTab";
import { ReviewsTab } from "./ReviewsTab";
import { DetailsTab } from "./DetailsTab";
import type { AdvancePaymentInfo } from "../api/booking.api";

export function ShopDetailView({ shopId }: { shopId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useT(customerBookingDict);
  const { language } = useLanguage();

  const { data: shop, isPending: shopPending } = useShopDetail(shopId);
  // Salon → "স্টাফ", parlour → "বিউটিশিয়ান". Defined after the shop query
  // because the tab label depends on what kind of business this is.
  const tt = useTerms(shop?.business_type, language);

  const TABS = [
    { id: "services", label: t("tabServices") },
    { id: "staff", label: tt("staff") },
    { id: "gallery", label: t("tabGallery") },
    { id: "reviews", label: t("tabReviews") },
    { id: "details", label: t("tabDetails") },
  ];
  const { data: services, isPending: servicesPending } = useShopServices(shopId);
  const { data: activeSerial, isPending: activePending } = useMyActiveSerial();
  const { guard } = useAuthGate();
  const { data: queueRows } = useShopQueuePublic(shopId);
  const { data: hasHistory } = useHasShopHistory(shopId);
  const { summary: reviewSummary } = useShopReviewsPublic(shopId);
  const { data: chairs } = useShopChairs(shopId);
  const createBooking = useCreateBooking();
  const createGroupBooking = useCreateGroupBooking();
  const showToast = useToast();
  const [tab, setTab] = useState("services");
  const [selected, setSelected] = useState<Set<string>>(() => {
    const raw = searchParams.get("services");
    return raw ? new Set(raw.split(",").filter(Boolean)) : new Set();
  });
  // Prefilled by "book again" — the staff member matters as much as the
  // services when someone is repeating a visit they liked.
  const [preferredChairId, setPreferredChairId] = useState<string | null>(
    () => searchParams.get("chair"),
  );
  const [advance, setAdvance] = useState(false);
  const [payingWith, setPayingWith] = useState(false);
  const [guests, setGuests] = useState<PartyGuest[]>([]);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const queueCount = queueRows?.length ?? 0;
  const waitMinutes = useMemo(
    () => minutesUntil(chairFreeAtMs(queueRows ?? []).values(), nowMs) ?? 0,
    [queueRows, nowMs],
  );

  const selectedServiceIds = useMemo(() => [...selected], [selected]);
  const { blockedByChairId } = useChairCapabilities(selectedServiceIds);
  const eligibleChairs = useMemo(() => {
    if (selectedServiceIds.length === 0) return [];
    return (chairs ?? []).filter((c) =>
      selectedServiceIds.every((sid) => !blockedByChairId.get(c.id)?.has(sid)),
    );
  }, [chairs, blockedByChairId, selectedServiceIds]);

  // Derived, not stored: a chair a customer picked earlier silently stops
  // counting as "preferred" the moment it's no longer eligible for the
  // current service selection (falls back to auto-assign for booking).
  const chairRatings = useChairRatings(eligibleChairs.map((c) => c.id));

  const effectivePreferredChairId = eligibleChairs.some((c) => c.id === preferredChairId)
    ? preferredChairId
    : null;

  if (shopPending || servicesPending || activePending) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (!shop) {
    return <p className="p-6 text-sm text-ink">{t("shopNotFound")}</p>;
  }

  if (activeSerial) {
    const sameShop = activeSerial.shop_id === shopId;
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent">
          <Ticket className="h-7 w-7" />
        </div>
        <p className="text-sm text-ink">
          {sameShop ? t("alreadyBookedSameShop") : t("alreadyBookedOtherShop")}
        </p>
        <Button size="lg" onClick={() => router.push("/my-serial")}>
          {t("viewMySerial")}
        </Button>
        {sameShop && (
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push(`/explore/${shopId}/chat`)}
          >
            <MessageCircle className="h-4 w-4" />
            {t("messageShop")}
          </Button>
        )}
      </div>
    );
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const availability = shopAvailability(shop);
  const breakLeft = breakMinutesLeft(shop);
  const bookable = canBookNow(shop);

  const selectedServices = services?.filter((s) => selected.has(s.id)) ?? [];
  const rateOf = (id: string) => services?.find((s) => s.id === id)?.rate ?? 0;
  const durationOf = (id: string) => services?.find((s) => s.id === id)?.default_duration_min ?? 0;

  // The party's numbers, not just the booker's: the sticky bar has to show
  // what will actually be paid at the counter.
  const totalMin =
    selectedServices.reduce((a, s) => a + s.default_duration_min, 0) +
    guests.reduce((a, g) => a + g.serviceIds.reduce((b, id) => b + durationOf(id), 0), 0);
  const totalAmount =
    selectedServices.reduce((a, s) => a + s.rate, 0) +
    guests.reduce((a, g) => a + g.serviceIds.reduce((b, id) => b + rateOf(id), 0), 0);

  const isParty = guests.length > 0;
  // A guest with nothing selected can't be booked, and silently dropping them
  // would be worse than blocking — the customer chose to add that person.
  const partyIncomplete = guests.some((g) => g.serviceIds.length === 0);

  const bookNow = (advanceInfo?: AdvancePaymentInfo) => {
    // Read (never re-request) the location Explore already obtained — this is
    // the wrong moment to raise a permission dialog. Missing/stale → null,
    // and the booking simply gets no leave-now nudge.
    const travelMin = estimateTravelMin(readRememberedLocation(), shop);
    const onSuccess = (toast: string) => () => {
      showToast(toast);
      router.push("/my-serial");
    };

    if (isParty) {
      // A party goes through one RPC so it can't end up half-created; advance
      // payment stays a solo-only option (it locks a single serial).
      createGroupBooking.mutate(
        {
          shopId,
          members: [
            { name: "", serviceIds: [...selected] },
            ...guests.map((g) => ({ name: g.name, serviceIds: g.serviceIds })),
          ],
          chairId: effectivePreferredChairId,
          travelMin,
        },
        { onSuccess: onSuccess(t("partyConfirmedToast", guests.length + 1)) },
      );
      return;
    }

    createBooking.mutate(
      {
        shopId,
        serviceIds: [...selected],
        advance: advanceInfo,
        chairId: effectivePreferredChairId,
        travelMin,
      },
      { onSuccess: onSuccess(advanceInfo ? t("advancePaidToast") : t("confirmedToast")) },
    );
  };

  // This page is public — a QR poster opens it — so the booking button is
  // reachable without an account. A guest gets the login dialog here, at the
  // moment they ask for something that needs one, rather than a failed RPC or
  // a login wall in front of the whole page.
  const onConfirm = guard(() => {
    if (advance && !isParty) {
      setPayingWith(true);
      return;
    }
    bookNow();
  });

  const booking = isParty ? createGroupBooking : createBooking;

  return (
    <div className="-mx-4 -mt-6 pb-32 sm:mx-0 sm:mt-0">
      <ShopHero shop={shop} summary={reviewSummary} />

      <div className="mx-auto max-w-lg px-4 sm:px-0">
        <ShopQuickActions shop={shop} hasHistory={hasHistory} />

        {/* One sentence instead of three stat tiles.
            "~0মি / আনুমানিক ওয়েট" was the app telling a customer to do
            arithmetic on a truncated number. What they came to find out is
            whether to set off now, so the panel answers that: an empty queue
            says walk in, a busy one gives the wait and how many are ahead. The
            service count moved out entirely — the list of services is directly
            below it. */}
        <div
          className={cn(
            "my-4.5 flex items-center gap-3 rounded-[18px] border p-4",
            queueCount === 0
              ? "border-good/25 bg-good-soft"
              : "border-line bg-soft",
          )}
        >
          <span
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-full",
              queueCount === 0 ? "bg-good/15 text-good" : "bg-live/15 text-live",
            )}
          >
            <Clock3 className="h-5.5 w-5.5" />
          </span>
          <div className="min-w-0">
            <p
              className={cn(
                "font-display text-[17px] leading-tight font-bold",
                queueCount === 0 ? "text-good" : "text-ink",
              )}
            >
              {queueCount === 0 ? t("queueEmptyHeadline") : t("queueWaitHeadline", waitMinutes)}
            </p>
            <p className="mt-0.5 text-[12px] text-muted">
              {queueCount === 0
                ? t("queueEmptySub")
                : t("queueWaitSub", queueCount)}
            </p>
          </div>
        </div>

        {availability === "CLOSED" && (
          <div className="mb-4 rounded-xl bg-live-soft px-4 py-3 text-sm font-medium text-live">
            {t("shopClosedNotice")}
          </div>
        )}
        {availability === "NOT_ACCEPTING" && (
          <div className="mb-4 rounded-xl bg-live-soft px-4 py-3 text-sm font-medium text-live">
            {t("notAcceptingNotice")}
          </div>
        )}
        {availability === "BREAK" && (
          <div className="mb-4 rounded-xl bg-brass-soft px-4 py-3 text-sm font-medium text-brass">
            {shop.break_reason
              ? t("breakNoticeWithReason", breakLeft, shop.break_reason)
              : t("breakNotice", breakLeft)}
          </div>
        )}

        <TabBar tabs={TABS} active={tab} onChange={setTab} className="mb-4" />

        {tab === "services" && (
          <ServicesTab
            services={services}
            selected={selected}
            onToggle={toggle}
            eligibleChairs={eligibleChairs}
            ratingByChairId={chairRatings}
            preferredChairId={effectivePreferredChairId}
            onPreferredChairChange={setPreferredChairId}
            advance={advance}
            onAdvanceChange={setAdvance}
          />
        )}
        {tab === "services" && selected.size > 0 && (
          <div className="mt-4">
            <PartySection
              services={services}
              ownServiceIds={selectedServiceIds}
              guests={guests}
              onGuestsChange={setGuests}
            />
          </div>
        )}

        {tab === "staff" && <StaffTab shopId={shopId} services={services} />}
        {tab === "gallery" && <GalleryTab shopId={shopId} />}
        {tab === "reviews" && <ReviewsTab shopId={shopId} />}
        {tab === "details" && <DetailsTab shop={shop} />}

        {booking.isError && (
          <p className="mt-4 text-sm text-live">
            {booking.error instanceof Error ? booking.error.message : t("bookingFailedGeneric")}
          </p>
        )}

        {selected.size > 0 && (
          <div className="sticky bottom-24 z-10 mt-4">
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-card/95 p-3.5 shadow-lg backdrop-blur">
              <div>
                <p className="text-[11px] text-muted">
                  {isParty
                    ? t("partyTotalLabel", guests.length + 1, totalMin)
                    : t("totalMinutesLabel", totalMin)}
                </p>
                <p className="font-number text-[22px] font-bold text-ink">৳{totalAmount}</p>
              </div>
              <Button
                size="lg"
                onClick={onConfirm}
                disabled={!bookable || selected.size === 0 || partyIncomplete}
                loading={booking.isPending}
                className="flex-1 font-display text-[15px] shadow-glow"
              >
                {booking.isPending
                  ? t("booking")
                  : isParty
                    ? t("takePartySerial", guests.length + 1)
                    : advance
                      ? t("confirmWithAdvance")
                      : t("takeSerial")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {payingWith && (
        <AdvancePaymentDialog
          amount={totalAmount}
          onClose={() => setPayingWith(false)}
          onSuccess={(info) => {
            setPayingWith(false);
            bookNow(info);
          }}
        />
      )}
    </div>
  );
}
