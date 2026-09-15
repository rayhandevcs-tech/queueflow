"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatBanglaDate, formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { useMyCoupons } from "../hooks/use-rewards";
import { rewardsDict } from "../lib/i18n";
import { redemptionState } from "../lib/rewards";

/**
 * The customer's coupons, on their existing profile page.
 *
 * Composed in beside the membership and loyalty cards rather than given a
 * route of its own — the same call Sprint 6 and Sprint 7 made, and for the
 * same reason: this is a thing you *have*, not a place you go.
 *
 * Every coupon carries its shop's name and logo, because a coupon works at
 * one shop and nowhere else. Usable ones come first, since those are the only
 * rows with anything left to do.
 *
 * Renders nothing at all for a customer with no coupons, so the page is
 * unchanged for everyone who has never redeemed.
 */
export function MyCouponsCard() {
  const t = useT(rewardsDict);
  const { data: coupons } = useMyCoupons();

  // `redemptionState` speaks the row's own column names; the RPC hands back
  // camelCase, so the adaptation happens here rather than by giving the pure
  // helper two shapes to understand.
  // One clock reading per mount, for the reason the catalogue table holds one:
  // a coupon must not read "ready" and "expired" on two renders of the same
  // second.
  const [now] = useState(() => new Date());
  const rows = useMemo(
    () =>
      (coupons ?? []).map((coupon) => ({
        ...coupon,
        state: redemptionState(
          { status: coupon.status, expires_at: coupon.expiresAt },
          now,
        ),
      })),
    [coupons, now],
  );

  if (rows.length === 0) return null;

  const num = (n: number) => toBanglaDigits(n);

  return (
    <section className="space-y-2.5">
      <div>
        <p className="text-[13px] font-semibold tracking-wide text-muted uppercase">
          {t("profileHeading")}
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted">{t("profileIntro")}</p>
      </div>

      <ul className="space-y-2.5">
        {rows.map((coupon) => {
          const usable = coupon.state === "USABLE";
          return (
            <li key={coupon.id}>
              <Link
                href={`/explore/${coupon.shopId}`}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border bg-card p-3.5 transition-colors hover:bg-soft",
                  usable ? "border-accent/35" : "border-line",
                )}
              >
                <AvatarChip
                  label={coupon.shopName}
                  avatarUrl={coupon.shopLogoUrl}
                  size={40}
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{coupon.rewardName}</p>
                  <p className="truncate text-[11px] text-muted">{coupon.shopName}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    <span>{t("spentPoints", num(coupon.pointsSpent))}</span>
                    {coupon.state === "USED" && coupon.usedAt && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{t("usedOn", formatBanglaDate(new Date(coupon.usedAt)))}</span>
                      </>
                    )}
                    {coupon.state === "USED" && (coupon.discountAmount ?? 0) > 0 && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="text-good">
                          {t("savedTaka", formatMoney(coupon.discountAmount ?? 0))}
                        </span>
                      </>
                    )}
                    {usable && coupon.expiresAt && (
                      <>
                        <span aria-hidden>·</span>
                        <span>{t("expiresOn", formatBanglaDate(new Date(coupon.expiresAt)))}</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  {/* The code is only worth showing while it can still be
                      used — a spent code is history, not an instruction. */}
                  {usable ? (
                    <p className="font-number text-[15px] leading-none font-bold tracking-[0.15em] text-ink">
                      {coupon.code}
                    </p>
                  ) : null}
                  <StatusPill
                    tone={usable ? "good" : coupon.state === "USED" ? "neutral" : "brass"}
                    dot={usable}
                    label={t(`state${coupon.state}` as "stateUSABLE")}
                    className="mt-1"
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
