"use client";

import { BN_MONTHS, EN_MONTHS, formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { Spinner } from "@/components/ui/Spinner";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Trophy } from "lucide-react";
import { useLanguage, useT } from "@/lib/i18n";
import { useIncomeSummary } from "../hooks/use-income-summary";
import { useManualEntryPickers } from "../hooks/use-manual-entries";
import { providerIncomeDict } from "../lib/i18n";
import { ManualEntrySection } from "./ManualEntrySection";

export function IncomeView({ shopId }: { shopId: string | undefined }) {
  const { summary, isPending } = useIncomeSummary(shopId);
  const { chairs } = useManualEntryPickers(shopId);
  const { language } = useLanguage();
  const t = useT(providerIncomeDict);

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  const now = new Date();
  const maxMonthly = Math.max(1, ...summary.monthlyTrend.map((m) => m.amount));
  const maxService = Math.max(1, ...summary.byService.map((s) => s.amount));
  const maxStaff = Math.max(1, ...summary.byStaff.map((s) => s.amount));
  const monthName = language === "en" ? EN_MONTHS[now.getMonth()] : BN_MONTHS[now.getMonth()];
  const yearLabel = toBanglaDigits(now.getFullYear());

  const staffLabel = (chairId: string) => {
    const chair = chairs.find((c) => c.id === chairId);
    return {
      name: chair?.staff_name || chair?.label || t("manualEntryUnknownService"),
      avatarUrl: chair?.staff_avatar_url,
    };
  };

  return (
    <div className="space-y-4.5">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">{t("incomeTrackingTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("incomeSubtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[20px] bg-accent p-5.5 text-accent-ink">
          <p className="text-[13px] opacity-60">{t("today")}</p>
          <p className="mt-1.5 font-number text-[32px] font-bold">
            ৳{formatMoney(summary.today.amount)}
          </p>
          <p className="mt-1 text-xs opacity-50">{t("jobsCountSuffix", summary.today.doneCount)}</p>
          <p className="mt-2 text-xs opacity-70">
            {t("cashDueBreakdown", formatMoney(summary.today.cash), formatMoney(summary.today.due))}
          </p>
        </div>
        <div className="rounded-[20px] border border-line bg-card p-5.5">
          <p className="text-[13px] text-muted">{t("thisMonth", monthName)}</p>
          <p className="mt-1.5 font-number text-[32px] font-bold text-ink">
            ৳{formatMoney(summary.month.amount)}
          </p>
          <p className="mt-1 text-xs text-good">
            {summary.month.changePct === null
              ? t("noIncomeLastMonth")
              : summary.month.changePct >= 0
                ? t("moreThanLastMonth", summary.month.changePct)
                : t("lessThanLastMonth", Math.abs(summary.month.changePct))}
          </p>
          <p className="mt-2 text-xs text-muted">
            {t("cashDueBreakdown", formatMoney(summary.month.cash), formatMoney(summary.month.due))}
          </p>
        </div>
        <div className="rounded-[20px] border border-line bg-card p-5.5">
          <p className="text-[13px] text-muted">{t("thisYear", yearLabel)}</p>
          <p className="mt-1.5 font-number text-[32px] font-bold text-ink">
            ৳{formatMoney(summary.year.amount)}
          </p>
          <p className="mt-2 text-xs text-muted">
            {t("cashDueBreakdown", formatMoney(summary.year.cash), formatMoney(summary.year.due))}
          </p>
        </div>
      </div>

      <div className="rounded-[20px] border border-line bg-card p-5.5">
        <div className="mb-4.5 flex items-center justify-between">
          <p className="font-semibold text-ink">{t("last12MonthsIncome")}</p>
          <p className="text-xs text-muted">{t("inThousands")}</p>
        </div>
        <div className="flex h-42.5 items-end gap-1.5 sm:gap-2.5">
          {summary.monthlyTrend.map((m, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.75">
              <div
                className="w-full max-w-8.5 rounded-t-[7px]"
                style={{
                  height: `${Math.max(2, (m.amount / maxMonthly) * 100)}%`,
                  background: m.isCurrent ? "var(--color-accent)" : "var(--color-brass-soft)",
                }}
                title={`৳${formatMoney(m.amount)}`}
              />
              <span
                className={m.isCurrent ? "text-[10px] font-semibold text-ink" : "text-[10px] text-muted"}
              >
                {m.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[20px] border border-line bg-card p-5.5">
        <p className="mb-3.5 font-semibold text-ink">{t("incomeByService")}</p>
        {summary.byService.length === 0 ? (
          <p className="text-sm text-muted">{t("noServicesDoneThisMonth")}</p>
        ) : (
          <div className="flex flex-col gap-3.25">
            {summary.byService.map((s) => (
              <div key={s.name}>
                <div className="mb-1.25 flex justify-between text-[13px] text-ink">
                  <span>{s.name}</span>
                  <b className="font-number">৳{formatMoney(s.amount)}</b>
                </div>
                <div className="h-2 rounded-md bg-soft">
                  <div
                    className="h-full rounded-md bg-accent"
                    style={{ width: `${Math.max(2, (s.amount / maxService) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[20px] border border-line bg-card p-5.5">
        <p className="mb-3.5 font-semibold text-ink">{t("incomeByStaff")}</p>
        {summary.byStaff.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-6 w-6" />}
            title={t("noStaffIncomeThisMonth")}
            className="border-none bg-transparent p-0 shadow-none"
          />
        ) : (
          <div className="flex flex-col gap-3.25">
            {summary.byStaff.map((s) => {
              const staff = staffLabel(s.chairId);
              return (
                <div key={s.chairId} className="flex items-center gap-3">
                  <AvatarChip label={staff.name} avatarUrl={staff.avatarUrl} size={36} shape="circle" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.25 flex justify-between text-[13px] text-ink">
                      <span className="truncate">{staff.name}</span>
                      <b className="font-number shrink-0">৳{formatMoney(s.amount)}</b>
                    </div>
                    <div className="h-2 rounded-md bg-soft">
                      <div
                        className="h-full rounded-md bg-accent"
                        style={{ width: `${Math.max(2, (s.amount / maxStaff) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {shopId && <ManualEntrySection shopId={shopId} />}
    </div>
  );
}
