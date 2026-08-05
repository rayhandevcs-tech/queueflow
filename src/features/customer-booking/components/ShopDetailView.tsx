"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageCircle, Ticket } from "lucide-react";
import { chairFreeAtMs, minutesUntil } from "@/lib/queue-wait";
import { readRememberedLocation } from "@/lib/last-location";
import { estimateTravelMin } from "@/lib/travel";
import { breakMinutesLeft, canBookNow, shopAvailability } from "@/lib/shop-availability";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { TabBar } from "@/components/ui/TabBar";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { customerBookingDict } from "../lib/i18n";
import {
  useChairCapabilities,
  useHasShopHistory,
  useShopChairs,
  useShopDetail,
  useShopServices,
} from "../hooks/use-shop-detail";
import { useShopReviewsPublic } from "../hooks/use-shop-reviews-public";
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

  const TABS = [
    { id: "services", label: t("tabServices") },
    { id: "staff", label: t("tabStaff") },
    { id: "gallery", label: t("tabGallery") },
    { id: "reviews", label: t("tabReviews") },
    { id: "details", label: t("tabDetails") },
  ];
  const { data: shop, isPending: shopPending } = useShopDetail(shopId);
  const { data: services, isPending: servicesPending } = useShopServices(shopId);
  const { data: activeSerial, isPending: activePending } = useMyActiveSerial();
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
  const [preferredChairId, setPreferredChairId] = useState<string | null>(null);
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

  const onConfirm = () => {
    if (advance && !isParty) {
      setPayingWith(true);
      return;
    }
    bookNow();
  };

  const booking = isParty ? createGroupBooking : createBooking;

  return (
    <div className="-mx-4 -mt-6 pb-32 sm:mx-0 sm:mt-0">
      <ShopHero shop={shop} summary={reviewSummary} />

      <div className="mx-auto max-w-lg px-4 sm:px-0">
        <ShopQuickActions shop={shop} hasHistory={hasHistory} />

        <div className="my-4.5 flex gap-2.5">
          <div className="flex-1 rounded-[14px] bg-accent p-3 text-center text-accent-ink">
            <p className="font-number text-[22px] font-bold">{queueCount}</p>
            <p className="text-[11px] opacity-70">{t("nowSerialLabel")}</p>
          </div>
          <div className="flex-1 rounded-[14px] border border-line bg-soft p-3 text-center">
            <p className="font-number text-[22px] font-bold text-live">
              ~{waitMinutes}
              <span className="text-[13px]">{t("minShort")}</span>
            </p>
            <p className="text-[11px] text-muted">{t("estWaitLabel")}</p>
          </div>
          <div className="flex-1 rounded-[14px] border border-line bg-soft p-3 text-center">
            <p className="font-number text-[22px] font-bold text-ink">{services?.length ?? 0}</p>
            <p className="text-[11px] text-muted">{t("servicesCountLabel")}</p>
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
