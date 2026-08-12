"use client";

import { Armchair, Star } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import type { Chair, Service } from "@/types";
import { useT } from "@/lib/i18n";
import { useChairCapabilities, useChairRatings, useShopChairs } from "../hooks/use-shop-detail";
import { customerBookingDict } from "../lib/i18n";

export function StaffTab({ shopId, services }: { shopId: string; services: Service[] | undefined }) {
  const { data: chairs, isPending } = useShopChairs(shopId);
  const allServiceIds = (services ?? []).map((s) => s.id);
  const { blockedByChairId } = useChairCapabilities(allServiceIds);
  const ratingByChairId = useChairRatings((chairs ?? []).map((c) => c.id));
  const t = useT(customerBookingDict);

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
        title={t("noStaffTitle")}
        description={t("noStaffDesc")}
      />
    );
  }

  return (
    // Photo-led cards rather than wide rows. Choosing a barber is the one
    // decision on this page made by looking at a face, so the face gets the
    // space; the services they can do sit underneath as a caption, since they
    // are a tie-breaker rather than the reason you picked anyone.
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {chairs.map((chair: Chair) => {
        const blockedIds = blockedByChairId.get(chair.id);
        const capableServices = (services ?? []).filter((s) => !blockedIds?.has(s.id));
        const rating = ratingByChairId.get(chair.id);
        return (
          <div
            key={chair.id}
            className="overflow-hidden rounded-[18px] border border-line bg-card p-2.5"
            style={{ borderTopWidth: 3, borderTopColor: chair.color ?? "#cbd5e1" }}
          >
            <div className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-[14px] bg-accent font-display text-3xl font-extrabold text-white">
              {chair.staff_avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={chair.staff_avatar_url}
                  alt={chair.staff_name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                (chair.staff_name || chair.label).trim().charAt(0).toUpperCase() || "?"
              )}

              {rating && (
                <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-full bg-card/95 px-1.5 py-0.5 text-[10px] font-bold text-brass shadow-xs backdrop-blur-sm">
                  <Star className="h-2.5 w-2.5 fill-current" />
                  {rating.avg_rating}
                </span>
              )}
            </div>

            <p className="mt-2 truncate text-sm font-bold text-ink">
              {chair.staff_name || chair.label}
            </p>
            {capableServices.length > 0 && (
              <p className="mt-0.5 truncate text-[11px] text-muted">
                {capableServices.map((s) => s.name).join(" · ")}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
