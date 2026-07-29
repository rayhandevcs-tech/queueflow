"use client";

import { Armchair, Star } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import type { Chair, Service } from "@/types";
import { useChairCapabilities, useChairRatings, useShopChairs } from "../hooks/use-shop-detail";

export function StaffTab({ shopId, services }: { shopId: string; services: Service[] | undefined }) {
  const { data: chairs, isPending } = useShopChairs(shopId);
  const allServiceIds = (services ?? []).map((s) => s.id);
  const { blockedByChairId } = useChairCapabilities(allServiceIds);
  const ratingByChairId = useChairRatings((chairs ?? []).map((c) => c.id));

  if (isPending) {
    return (
      <div className="grid min-h-32 place-items-center">
        <Spinner className="h-5 w-5 text-muted" />
      </div>
    );
  }

  if (!chairs?.length) {
    return (
      <EmptyState
        icon={<Armchair className="h-6 w-6" />}
        title="কোনো স্টাফ তথ্য নেই"
        description="এই দোকান এখনো স্টাফ/চেয়ারের তথ্য যোগ করেনি।"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {chairs.map((chair: Chair) => {
        const blockedIds = blockedByChairId.get(chair.id);
        const capableServices = (services ?? []).filter((s) => !blockedIds?.has(s.id));
        return (
          <div
            key={chair.id}
            className="flex items-start gap-3 rounded-2xl border border-line bg-card p-4"
            style={{ borderLeftWidth: 4, borderLeftColor: chair.color ?? "#cbd5e1" }}
          >
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-accent font-display text-lg font-bold text-white">
              {chair.staff_avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={chair.staff_avatar_url}
                  alt={chair.staff_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                (chair.staff_name || chair.label).trim().charAt(0).toUpperCase() || "?"
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-semibold text-ink">
                  {chair.staff_name || chair.label}
                </p>
                {ratingByChairId.get(chair.id) && (
                  <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-brass">
                    <Star className="h-3 w-3 fill-brass" />
                    {ratingByChairId.get(chair.id)!.avg_rating}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted">{chair.label}</p>
              {capableServices.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {capableServices.map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full bg-soft px-2.5 py-1 text-[11px] font-medium text-muted"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
