"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, ChevronRight, Crown } from "lucide-react";
import type { Shop } from "@/types";
import { cn } from "@/lib/utils";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatBanglaDate, formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { useMembershipShops, useMyMemberships } from "../hooks/use-memberships";
import { membershipDict } from "../lib/i18n";
import { daysLeft, effectiveStatus, isLiveStatus, soldAs } from "../lib/membership";

/**
 * The customer's memberships, on their existing profile page.
 *
 * A section on `/profile` rather than a new route, because the brief was
 * explicit about not inventing navigation and because this belongs with the
 * other things a customer holds — favourites, spending, visit history.
 *
 * One card per shop, never a total. That is the same call decision 33 made for
 * loyalty points: a membership is worth something at exactly one shop, and a
 * combined figure would invite a customer to think otherwise. Each card names
 * and pictures its shop for the same reason.
 *
 * Renders nothing at all when the customer has no memberships — an empty
 * section on a busy page is noise, and there is no action to offer from here
 * (joining happens on a shop's own page).
 *
 * It loads its own shops rather than borrowing the profile page's map: that
 * map is built from *visit* history, and a customer can hold a membership
 * somewhere they have not been served yet.
 */
export function MyMembershipsCard() {
  const t = useT(membershipDict);
  const [now] = useState(() => new Date());
  const { data: memberships } = useMyMemberships();

  const shopIds = useMemo(
    () => [...new Set((memberships ?? []).map((m) => m.shop_id))],
    [memberships],
  );
  const { data: shops } = useMembershipShops(shopIds);
  const shopFor = (shopId: string): Shop | undefined =>
    (shops ?? []).find((shop) => shop.id === shopId);

  // Live ones first, then the finished ones as history. A cancelled membership
  // is still a thing the customer paid for and may want to see.
  const rows = useMemo(
    () =>
      [...(memberships ?? [])].sort((a, b) => {
        const aLive = isLiveStatus(a.status) && effectiveStatus(a, now) !== "EXPIRED";
        const bLive = isLiveStatus(b.status) && effectiveStatus(b, now) !== "EXPIRED";
        if (aLive !== bLive) return aLive ? -1 : 1;
        return b.created_at.localeCompare(a.created_at);
      }),
    [memberships, now],
  );

  if (rows.length === 0) return null;

  return (
    <section className="space-y-2.5">
      <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">
        {t("profileHeading")}
      </p>

      <ul className="space-y-2.5">
        {rows.map((membership) => {
          const shop = shopFor(membership.shop_id);
          const status = effectiveStatus(membership, now);
          const left = daysLeft(membership, now);
          const sold = soldAs(membership);
          const live = status === "ACTIVE" || status === "PENDING";

          return (
            <li key={membership.id}>
              <Link
                href={`/explore/${membership.shop_id}`}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border bg-card p-3.5 transition-colors hover:bg-soft",
                  live ? "border-accent/35" : "border-line opacity-75",
                )}
              >
                <AvatarChip label={shop?.name} avatarUrl={shop?.logo_url} size={40} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {shop?.name ?? t("profileSeeShop")}
                  </p>
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    <Crown className="h-3 w-3 shrink-0" />
                    <span className="truncate">{sold.name}</span>
                    <span aria-hidden>·</span>
                    <span className="font-number">৳{formatMoney(membership.price)}</span>
                  </p>
                  {status === "ACTIVE" && membership.expires_at && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                      <CalendarClock className="h-3 w-3 shrink-0" />
                      {left !== null
                        ? t("daysLeft", toBanglaDigits(left))
                        : formatBanglaDate(new Date(membership.expires_at))}
                    </p>
                  )}
                  {status === "EXPIRED" && membership.expires_at && (
                    <p className="mt-0.5 text-[11px] text-muted">
                      {t("expiredOn", formatBanglaDate(new Date(membership.expires_at)))}
                    </p>
                  )}
                </div>

                <StatusPill
                  tone={status === "ACTIVE" ? "good" : status === "PENDING" ? "brass" : "neutral"}
                  dot={status === "ACTIVE"}
                  label={t(`status${status}` as "statusACTIVE")}
                  className="shrink-0"
                />
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
