"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Ticket } from "lucide-react";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import { chairFreeAtMs, minutesUntil } from "@/lib/queue-wait";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useShopDetail, useShopServices } from "../hooks/use-shop-detail";
import { useMyActiveSerial, useShopQueuePublic } from "../hooks/use-my-serial";
import { useCreateBooking } from "../hooks/use-booking-mutations";

export function ShopDetailView({ shopId }: { shopId: string }) {
  const router = useRouter();
  const { data: shop, isPending: shopPending } = useShopDetail(shopId);
  const { data: services, isPending: servicesPending } = useShopServices(shopId);
  const { data: activeSerial, isPending: activePending } = useMyActiveSerial();
  const { data: queueRows } = useShopQueuePublic(shopId);
  const createBooking = useCreateBooking();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [advance, setAdvance] = useState(false);

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

  if (shopPending || servicesPending || activePending) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (!shop) {
    return <p className="p-6 text-sm text-ink">দোকান খুঁজে পাওয়া যায়নি।</p>;
  }

  if (activeSerial) {
    const sameShop = activeSerial.shop_id === shopId;
    return (
      <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent/10 text-accent">
          <Ticket className="h-7 w-7" />
        </div>
        <p className="text-sm text-ink">
          {sameShop
            ? "তোমার এই দোকানে ইতিমধ্যে একটা সিরিয়াল আছে।"
            : "তোমার ইতিমধ্যে একটা সক্রিয় সিরিয়াল আছে — একসাথে একটাই রাখা যায়।"}
        </p>
        <Button size="lg" onClick={() => router.push("/my-serial")}>
          আমার সিরিয়াল দেখো
        </Button>
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

  const selectedServices = services?.filter((s) => selected.has(s.id)) ?? [];
  const totalMin = selectedServices.reduce((a, s) => a + s.default_duration_min, 0);
  const totalAmount = selectedServices.reduce((a, s) => a + s.rate, 0);

  const onConfirm = () => {
    createBooking.mutate(
      { shopId, serviceIds: [...selected] },
      { onSuccess: () => router.push("/my-serial") },
    );
  };

  return (
    <div className="-mx-4 -mt-6 pb-32 sm:mx-0 sm:mt-0">
      <div
        className="relative h-29.5 w-full sm:rounded-2xl"
        style={{
          background:
            "linear-gradient(120deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 60%, black))",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/explore")}
          className="absolute left-4 top-3.5 grid h-9 w-9 place-items-center rounded-[11px] bg-white/20 text-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto max-w-lg px-4 sm:px-0">
        <div className="-mt-5 flex items-end gap-3.5">
          <div className="grid h-18.5 w-18.5 shrink-0 place-items-center overflow-hidden rounded-[20px] border-4 border-card bg-accent font-display text-3xl font-extrabold text-white">
            {shop.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shop.cover_image_url}
                alt={shop.name}
                className="h-full w-full object-cover"
              />
            ) : (
              shop.name.trim().charAt(0).toUpperCase() || "?"
            )}
          </div>
          <div className="pb-1">
            <p className="font-display text-xl leading-tight font-bold text-ink">{shop.name}</p>
            <p className="text-xs text-muted">
              {BUSINESS_TYPE_LABEL[shop.business_type]}
              {shop.address ? ` · ${shop.address}` : ""}
            </p>
          </div>
        </div>

        <div className="my-4.5 flex gap-2.5">
          <div className="flex-1 rounded-[14px] border border-line bg-soft p-3 text-center">
            <p className="font-number text-[22px] font-bold text-ink">{queueCount}</p>
            <p className="text-[11px] text-muted">এখন সিরিয়াল</p>
          </div>
          <div className="flex-1 rounded-[14px] border border-line bg-soft p-3 text-center">
            <p className="font-number text-[22px] font-bold text-live">
              ~{waitMinutes}
              <span className="text-[13px]">মি</span>
            </p>
            <p className="text-[11px] text-muted">আনুমানিক ওয়েট</p>
          </div>
          <div className="flex-1 rounded-[14px] border border-line bg-soft p-3 text-center">
            <p className="font-number text-[22px] font-bold text-ink">{services?.length ?? 0}</p>
            <p className="text-[11px] text-muted">সার্ভিস</p>
          </div>
        </div>

        {!shop.is_open && (
          <div className="mb-4 rounded-xl bg-live-soft px-4 py-3 text-sm font-medium text-live">
            দোকান এখন বন্ধ — এই মুহূর্তে বুকিং করা যাচ্ছে না
          </div>
        )}

        <p className="mb-2.5 text-[13px] font-semibold tracking-wide text-muted uppercase">
          সার্ভিস বেছে নাও
        </p>

        {!services?.length ? (
          <p className="text-sm text-muted">এই দোকানে এখনো কোনো সার্ভিস যোগ করা হয়নি।</p>
        ) : (
          <div className="flex flex-col gap-2.25">
            {services.map((s) => {
              const on = selected.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggle(s.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[14px] border p-3.5 text-left transition-all",
                    on ? "border-accent bg-accent/[0.07]" : "border-line bg-card",
                  )}
                  style={{ borderWidth: 1.5 }}
                >
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-lg border text-sm font-bold text-white",
                      on ? "border-accent bg-accent" : "border-line bg-transparent",
                    )}
                    style={{ borderWidth: 1.5 }}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{s.name}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">
                      ~{s.default_duration_min} মিনিট
                    </span>
                  </span>
                  <span className="font-number text-[15px] font-semibold text-ink">
                    ৳{s.rate}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4.5 rounded-2xl border border-line bg-soft p-3.5">
          <label className="flex cursor-pointer items-center gap-3">
            <span
              className="relative inline-block h-6 w-10.5 shrink-0 rounded-full transition-colors"
              style={{ background: advance ? "var(--color-accent)" : "var(--color-line)" }}
            >
              <input
                type="checkbox"
                checked={advance}
                onChange={(e) => setAdvance(e.target.checked)}
                className="sr-only"
              />
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                style={{ left: advance ? "22px" : "2px" }}
              />
            </span>
            <span className="flex-1">
              <span className="block text-[13px] font-semibold text-ink">
                অ্যাডভান্স পেমেন্ট দিয়ে সিরিয়াল লক করো
              </span>
              <span className="block text-[11px] text-muted">
                bKash/Nagad — সিরিয়াল কনফার্ম ও সিকিউর থাকবে
              </span>
            </span>
          </label>
        </div>

        {createBooking.isError && (
          <p className="mt-4 text-sm text-live">
            {createBooking.error instanceof Error
              ? createBooking.error.message
              : "বুক করা যায়নি — আবার চেষ্টা করো।"}
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-24 z-10 mx-auto max-w-lg px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-card/95 p-3.5 shadow-lg backdrop-blur">
          <div>
            <p className="text-[11px] text-muted">মোট · {totalMin} মিনিট</p>
            <p className="font-number text-[22px] font-bold text-ink">৳{totalAmount}</p>
          </div>
          <Button
            size="lg"
            onClick={onConfirm}
            disabled={!shop.is_open || selected.size === 0}
            loading={createBooking.isPending}
            className="flex-1 font-display text-[15px] shadow-glow"
          >
            {createBooking.isPending
              ? "বুক হচ্ছে…"
              : advance
                ? "অ্যাডভান্স দিয়ে কনফার্ম"
                : "সিরিয়াল নাও"}
          </Button>
        </div>
      </div>
    </div>
  );
}
