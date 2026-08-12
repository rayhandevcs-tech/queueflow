"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Repeat, Star, Store } from "lucide-react";
import type { Serial, Shop } from "@/types";
import { parseServicesSnapshot } from "@/types";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { formatBanglaDate, formatMoney } from "@/lib/format-wait";
import { EmptyState } from "@/components/ui/EmptyState";
import { useT } from "@/lib/i18n";
import { customerProfileDict } from "../lib/i18n";
import { ReviewDialog } from "./ReviewDialog";
import { EReceiptSheet } from "./EReceiptSheet";

/** Same shop, same services, same staff — the shop page reads all three. */
function rebookHref(s: Serial): string {
  const params = new URLSearchParams({ services: s.service_ids.join(",") });
  if (s.chair_id) params.set("chair", s.chair_id);
  return `/explore/${s.shop_id}?${params.toString()}`;
}

export function CompletedBookingsList({
  bookings,
  shopsById,
  ratingsBySerial,
}: {
  bookings: Serial[];
  shopsById: Record<string, Shop>;
  ratingsBySerial: Record<string, number>;
}) {
  const router = useRouter();
  const [reviewing, setReviewing] = useState<Serial | null>(null);
  const [receiptFor, setReceiptFor] = useState<Serial | null>(null);
  const t = useT(customerProfileDict);

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={<Store className="h-6 w-6" />}
        title={t("noCompletedTitle")}
        description={t("noCompletedDesc")}
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
            {/* Shop logo, initial as fallback — same treatment as the
                transactions list, so a shop looks the same wherever you meet
                its history. */}
            <div
              className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl font-display font-bold text-white"
              style={{ background: shop ? shopAvatarColor(shop.id) : "var(--color-muted)" }}
            >
              {shop?.logo_url || shop?.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shop.logo_url ?? shop.cover_image_url ?? undefined}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : shop ? (
                shopInitial(shop.name)
              ) : (
                <Store className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">{shop?.name ?? t("shopFallback")}</p>
              <p className="truncate text-[11px] text-muted">
                {shop?.address ? `${shop.address.split(",")[0].trim()} · ` : ""}
                {formatBanglaDate(new Date(s.completed_at ?? s.created_at))}
              </p>
              <p className="truncate text-[10px] text-muted">
                {services.map((sv) => sv.name).join(" + ") || "—"} · {t("codeLabel", code)}
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
                  {t("giveReview")}
                </button>
              )}
              {/* Repeat business lives here, not on the cancelled tab where
                  the only rebook button used to be. Carries the same staff
                  through too — "the usual, with the usual person". */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(rebookHref(s));
                }}
                className="mt-1 flex items-center gap-0.5 text-[10px] font-semibold text-muted hover:text-accent"
              >
                <Repeat className="h-2.5 w-2.5" />
                {t("bookAgainShort")}
              </button>
            </div>
          </div>
        );
      })}

      {reviewing && (
        <ReviewDialog
          shopId={reviewing.shop_id}
          serialId={reviewing.id}
          shopName={shopsById[reviewing.shop_id]?.name ?? t("shopFallback")}
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
