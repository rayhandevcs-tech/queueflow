"use client";

import { Check, Clock3, Crown, Percent, Sparkles, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { StatusPill } from "@/components/ui/StatusPill";
import { parseBenefits, type MembershipBenefit, type MembershipBenefitKind } from "@/types";
import type { Json } from "@/types";
import { membershipDict } from "../lib/i18n";

const BENEFIT_ICON: Record<MembershipBenefitKind, typeof Percent> = {
  DISCOUNT: Percent,
  FREE_SERVICE: Sparkles,
  PRIORITY_BOOKING: Zap,
  COMPLIMENTARY: Star,
  SPECIAL_OFFER: Crown,
};

/**
 * One package, as both sides see it.
 *
 * The same card on the owner's management page and the customer's shop page,
 * with the actions passed in as a slot — because they are looking at the same
 * object and any difference in how it reads would be a difference in what
 * either of them thinks was promised.
 */
export function TierCard({
  name,
  description,
  price,
  durationDays,
  benefits,
  inactive,
  highlight,
  footer,
}: {
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  /** Raw jsonb or an already-parsed list — both are accepted. */
  benefits: Json | MembershipBenefit[];
  inactive?: boolean;
  /** Draws the accent border — used for the tier the customer already holds. */
  highlight?: boolean;
  footer?: React.ReactNode;
}) {
  const t = useT(membershipDict);
  const list = Array.isArray(benefits) && benefits.every((b) => b && typeof b === "object" && "kind" in b)
    ? (benefits as MembershipBenefit[])
    : parseBenefits(benefits as Json);

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs",
        highlight ? "border-accent/60 ring-2 ring-accent/15" : "border-line",
        inactive && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-[17px] font-bold text-ink">{name}</p>
          {description && (
            <p className="mt-0.5 text-[12px] leading-snug text-muted">{description}</p>
          )}
        </div>
        {inactive && <StatusPill tone="neutral" dot={false} label={t("tierInactiveLabel")} />}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-[26px] leading-none font-bold text-ink">
          ৳{formatMoney(price)}
        </span>
        <span className="flex items-center gap-1 text-[12px] text-muted">
          <Clock3 className="h-3.5 w-3.5" />
          {t("forDays", toBanglaDigits(durationDays))}
        </span>
      </div>

      {list.length > 0 && (
        <ul className="space-y-1.5">
          {list.map((benefit, index) => {
            const Icon = BENEFIT_ICON[benefit.kind] ?? Check;
            return (
              <li key={`${benefit.kind}-${index}`} className="flex items-start gap-2 text-[13px] text-ink">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                <span className="leading-snug">{benefit.label}</span>
              </li>
            );
          })}
        </ul>
      )}

      {footer && <div className="mt-auto pt-1">{footer}</div>}
    </div>
  );
}
