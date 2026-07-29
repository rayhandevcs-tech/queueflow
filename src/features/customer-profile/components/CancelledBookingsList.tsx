"use client";

import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import type { Serial, Shop } from "@/types";
import { parseServicesSnapshot } from "@/types";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { formatBanglaDate, formatMoney } from "@/lib/format-wait";
import { EmptyState } from "@/components/ui/EmptyState";

export function CancelledBookingsList({
  bookings,
  shopsById,
}: {
  bookings: Serial[];
  shopsById: Record<string, Shop>;
}) {
  const router = useRouter();

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={<Store className="h-6 w-6" />}
        title="বাতিল হওয়া কোনো সিরিয়াল নেই"
        description="বাতিল বা মিস হওয়া সিরিয়াল এখানে দেখতে পাবে।"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.25">
      {bookings.map((s) => {
        const shop = shopsById[s.shop_id];
        const services = parseServicesSnapshot(s.services_snapshot);

        return (
          <div key={s.id} className="rounded-[14px] border border-line bg-card p-3.25">
            <div className="flex items-center gap-3">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display font-bold text-white"
                style={{ background: shop ? shopAvatarColor(shop.id) : "var(--color-muted)" }}
              >
                {shop ? shopInitial(shop.name) : <Store className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">{shop?.name ?? "দোকান"}</p>
                <p className="truncate text-[11px] text-muted">
                  {shop?.address ? `${shop.address} · ` : ""}
                  {formatBanglaDate(new Date(s.created_at))}
                </p>
                <p className="truncate text-[10px] text-muted">
                  {services.map((sv) => sv.name).join(" + ") || "—"}
                </p>
              </div>
              <p className="shrink-0 font-number text-[13px] font-semibold text-muted line-through">
                ৳{formatMoney(s.total_amount)}
              </p>
            </div>

            {shop && (
              <button
                type="button"
                onClick={() => router.push(`/explore/${s.shop_id}?services=${s.service_ids.join(",")}`)}
                className="mt-3 w-full rounded-[12px] bg-accent py-2.5 text-[13px] font-bold text-accent-ink"
              >
                আবার বুক করুন
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
