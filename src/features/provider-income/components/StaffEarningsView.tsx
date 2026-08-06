"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock3, Percent, Store, Users } from "lucide-react";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { formatMoney } from "@/lib/format-wait";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useStaffEarnings, type EarningsPeriod } from "../hooks/use-staff-earnings";
import { providerIncomeDict } from "../lib/i18n";

/**
 * Who brought in what, and what they're owed.
 *
 * Salon staff are usually on a cut rather than a wage, and until now the owner
 * kept that sum in a notebook while the app held every number needed for it.
 * This is the screen he'll open on payday — which is the whole point: he might
 * run his queue elsewhere, but he won't move his payroll.
 */
export function StaffEarningsView({ shopId }: { shopId: string | undefined }) {
  const [period, setPeriod] = useState<EarningsPeriod>("month");
  const { earnings, chairs, isPending } = useStaffEarnings(shopId, period);
  const t = useT(providerIncomeDict);

  if (isPending) {
    return (
      <div className="grid min-h-[30vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (chairs.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title={t("noStaffTitle")}
        description={t("noStaffDesc")}
        action={
          <Link href="/chairs" className="text-sm font-semibold text-accent hover:underline">
            {t("goToChairs")}
          </Link>
        }
      />
    );
  }

  const totalStaffShare = earnings.reduce((sum, e) => sum + e.staffShare, 0);
  const totalShopShare = earnings.reduce((sum, e) => sum + e.shopShare, 0);
  const totalPendingShare = earnings.reduce((sum, e) => sum + e.pendingShare, 0);
  const noCommissionSet = earnings.every((e) => e.commissionPct === 0);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(
          [
            ["month", t("thisMonthShort")],
            ["year", t("thisYearShort")],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
            className={cn(
              "min-h-9 rounded-full px-3.5 text-xs font-semibold",
              period === key ? "bg-accent text-accent-ink" : "bg-soft text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          value={`৳${formatMoney(totalStaffShare)}`}
          label={t("staffShareTotal")}
          icon={<Users className="h-4 w-4" />}
        />
        <StatTile
          value={`৳${formatMoney(totalShopShare)}`}
          label={t("shopShareTotal")}
          accentValue="accent"
          tone="accent"
          icon={<Store className="h-4 w-4" />}
        />
        <StatTile
          value={`৳${formatMoney(totalPendingShare)}`}
          label={t("pendingShareTotal")}
          accentValue="brass"
          tone={totalPendingShare > 0 ? "brass" : "plain"}
          icon={<Clock3 className="h-4 w-4" />}
        />
      </div>

      {/* Not an error state — just the one thing that makes this page useful. */}
      {noCommissionSet && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brass-soft px-3.5 py-2.5 text-xs text-brass">
          <Percent className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{t("noCommissionSetHint")}</span>
          <Link href="/chairs" className="shrink-0 font-semibold underline">
            {t("setCommissionCta")}
          </Link>
        </div>
      )}

      <ul className="space-y-3">
        {earnings.map((e) => {
          const chair = chairs.find((c) => c.id === e.chairId);
          const name = chair?.staff_name || chair?.label || "—";
          return (
            <li key={e.chairId}>
              <Card className="p-4">
              <div className="flex items-center gap-3">
                <AvatarChip
                  label={name}
                  avatarUrl={chair?.staff_avatar_url}
                  shape="circle"
                  size={38}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{name}</p>
                  <p className="text-[11px] text-muted">
                    {t("jobsAndCommission", e.jobs, e.commissionPct)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-muted">{t("broughtInLabel")}</p>
                  <p className="font-number text-lg font-bold text-ink">
                    ৳{formatMoney(e.collected + e.pending)}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
                <div>
                  <p className="text-[10px] text-muted">{t("staffGetsLabel")}</p>
                  <p className="font-number text-sm font-bold text-ink">
                    ৳{formatMoney(e.staffShare)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted">{t("shopKeepsLabel")}</p>
                  <p className="font-number text-sm font-bold text-accent">
                    ৳{formatMoney(e.shopShare)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted">{t("afterDueLabel")}</p>
                  <p
                    className={cn(
                      "font-number text-sm font-bold",
                      e.pendingShare > 0 ? "text-brass" : "text-muted",
                    )}
                  >
                    ৳{formatMoney(e.pendingShare)}
                  </p>
                </div>
              </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <p className="text-[11px] leading-relaxed text-muted">{t("commissionRuleNote")}</p>
    </div>
  );
}
