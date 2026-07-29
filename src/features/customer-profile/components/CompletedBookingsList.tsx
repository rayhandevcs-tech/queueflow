"use client";

import { useState } from "react";
import { Star, Store } from "lucide-react";
import type { Serial, Shop } from "@/types";
import { parseServicesSnapshot } from "@/types";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { formatBanglaDate, formatMoney } from "@/lib/format-wait";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReviewDialog } from "./ReviewDialog";
import { EReceiptSheet } from "./EReceiptSheet";

export function CompletedBookingsList({
  bookings,
  shopsById,
  ratingsBySerial,
}: {
  bookings: Serial[];
  shopsById: Record<string, Shop>;
  ratingsBySerial: Record<string, number>;
}) {
  const [reviewing, setReviewing] = useState<Serial | null>(null);
  const [receiptFor, setReceiptFor] = useState<Serial | null>(null);

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={<Store className="h-6 w-6" />}
        title="এখনো কোনো সিরিয়াল সম্পন্ন হয়নি"
        description="সার্ভিস সম্পন্ন হলে এখানে রিসিটসহ দেখতে পাবে।"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.25">
      {bookings.map((s) => {
        const shop = shopsById[s.shop_id];
        const services = parseServicesSnapshot(s.services_snapshot);
        const rating = ratingsBySerial[s.id];
        const code = s.id.slice(0, 8).toUpperCase();

        return (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            onClick={() => setReceiptFor(s)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setReceiptFor(s);
            }}
            className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-line bg-card p-3.25 text-left"
          >
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
                {formatBanglaDate(new Date(s.completed_at ?? s.created_at))}
              </p>
              <p className="truncate text-[10px] text-muted">
                {services.map((sv) => sv.name).join(" + ") || "—"} · কোড {code}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-number text-[13px] font-semibold text-ink">
                ৳{formatMoney(s.total_amount)}
              </p>
              {rating ? (
                <p className="text-[10px] text-brass">★ {rating}</p>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReviewing(s);
                  }}
                  className="flex items-center gap-0.5 text-[10px] font-semibold text-accent"
                >
                  <Star className="h-2.5 w-2.5" />
                  রিভিউ দাও
                </button>
              )}
            </div>
          </div>
        );
      })}

      {reviewing && (
        <ReviewDialog
          shopId={reviewing.shop_id}
          serialId={reviewing.id}
          shopName={shopsById[reviewing.shop_id]?.name ?? "দোকান"}
          shopAvatarBg={
            shopsById[reviewing.shop_id] ? shopAvatarColor(reviewing.shop_id) : "var(--color-muted)"
          }
          shopInitial={
            shopsById[reviewing.shop_id] ? shopInitial(shopsById[reviewing.shop_id].name) : "?"
          }
          onClose={() => setReviewing(null)}
        />
      )}

      {receiptFor && (
        <EReceiptSheet
          serial={receiptFor}
          shop={shopsById[receiptFor.shop_id]}
          onClose={() => setReceiptFor(null)}
        />
      )}
    </div>
  );
}
