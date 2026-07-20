"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, MapPin, Store, Ticket } from "lucide-react";
import { BUSINESS_TYPE_LABEL } from "@/config/constants";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useShopDetail, useShopServices } from "../hooks/use-shop-detail";
import { useMyActiveSerial } from "../hooks/use-my-serial";
import { useCreateBooking } from "../hooks/use-booking-mutations";

export function ShopDetailView({ shopId }: { shopId: string }) {
  const router = useRouter();
  const { data: shop, isPending: shopPending } = useShopDetail(shopId);
  const { data: services, isPending: servicesPending } = useShopServices(shopId);
  const { data: activeSerial, isPending: activePending } = useMyActiveSerial();
  const createBooking = useCreateBooking();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (shopPending || servicesPending || activePending) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (!shop) {
    return <p className="p-6 text-sm text-ink">Shop not found.</p>;
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
            ? "You already have a serial at this shop."
            : "You already have an active serial — only one at a time."}
        </p>
        <Button size="lg" onClick={() => router.push("/my-serial")}>
          View my serial
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
    <div className="-mx-4 -mt-6 pb-28 sm:mx-0 sm:mt-0">
      <div className="relative h-48 w-full bg-soft sm:rounded-2xl">
        {shop.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shop.cover_image_url}
            alt={shop.name}
            className="h-full w-full object-cover sm:rounded-2xl"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted sm:rounded-2xl">
            <Store className="h-10 w-10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent sm:rounded-2xl" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h1 className="font-display text-2xl font-bold text-accent-ink drop-shadow-sm">
            {shop.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-accent-ink/80">
            <Badge variant="accent" className="bg-accent-ink/15 text-accent-ink">
              {BUSINESS_TYPE_LABEL[shop.business_type]}
            </Badge>
            {shop.address && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {shop.address}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg space-y-6 px-4 pt-5 sm:px-0">
        {!shop.is_open && (
          <div className="rounded-xl bg-live-soft px-4 py-3 text-sm font-medium text-live">
            Shop is currently closed — bookings aren&apos;t open right now
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-semibold text-ink">Choose services</p>
          {!services?.length ? (
            <p className="text-sm text-muted">This shop has no services yet.</p>
          ) : (
            <div className="space-y-2">
              {services.map((s) => {
                const on = selected.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                      on
                        ? "border-accent bg-accent/5 shadow-sm ring-1 ring-accent/20"
                        : "border-line bg-card hover:border-accent/30",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors",
                        on
                          ? "border-accent bg-accent text-accent-ink"
                          : "border-line text-transparent",
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{s.name}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                        <Clock3 className="h-3 w-3" />
                        ~{s.default_duration_min} min
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-ink">৳{s.rate}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {createBooking.isError && (
          <p className="text-sm text-live">
            {createBooking.error instanceof Error
              ? createBooking.error.message
              : "Couldn't book — please try again."}
          </p>
        )}
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-line bg-card/95 p-4 shadow-[0_-8px_24px_rgba(27,24,18,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-lg items-center gap-4">
            <div>
              <p className="text-xs text-muted">Total · {totalMin} min</p>
              <p className="font-display text-lg font-bold">৳{totalAmount}</p>
            </div>
            <Button
              size="lg"
              onClick={onConfirm}
              disabled={!shop.is_open}
              loading={createBooking.isPending}
              className="flex-1"
            >
              {createBooking.isPending ? "Booking…" : "Book serial"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
