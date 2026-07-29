"use client";

import { BN_MONTHS, formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { Spinner } from "@/components/ui/Spinner";
import { useIncomeSummary } from "../hooks/use-income-summary";

export function IncomeView({ shopId }: { shopId: string | undefined }) {
  const { summary, isPending } = useIncomeSummary(shopId);

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

  return (
    <div className="space-y-4.5">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">ইনকাম ট্র্যাকিং</h1>
        <p className="mt-1 text-sm text-muted">
          প্রতিটি কাজের আয় অটো যোগ হয় — &ldquo;কাজ সম্পন্ন&rdquo; চাপলেই
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-[20px] bg-accent p-5.5 text-accent-ink">
          <p className="text-[13px] opacity-60">আজ</p>
          <p className="mt-1.5 font-number text-[32px] font-bold">
            ৳{formatMoney(summary.today.amount)}
          </p>
          <p className="mt-1 text-xs opacity-50">{summary.today.doneCount} টি কাজ</p>
        </div>
        <div className="rounded-[20px] border border-line bg-card p-5.5">
          <p className="text-[13px] text-muted">এই মাস ({BN_MONTHS[now.getMonth()]})</p>
          <p className="mt-1.5 font-number text-[32px] font-bold text-ink">
            ৳{formatMoney(summary.month.amount)}
          </p>
          <p className="mt-1 text-xs text-good">
            {summary.month.changePct === null
              ? "গত মাসে কোনো আয় ছিল না"
              : summary.month.changePct >= 0
                ? `▲ গত মাসের চেয়ে ${summary.month.changePct}%`
                : `▼ গত মাসের চেয়ে ${Math.abs(summary.month.changePct)}%`}
          </p>
        </div>
        <div className="rounded-[20px] border border-line bg-card p-5.5">
          <p className="text-[13px] text-muted">এই বছর ({toBanglaDigits(now.getFullYear())})</p>
          <p className="mt-1.5 font-number text-[32px] font-bold text-ink">
            ৳{formatMoney(summary.year.amount)}
          </p>
        </div>
      </div>

      <div className="rounded-[20px] border border-line bg-card p-5.5">
        <div className="mb-4.5 flex items-center justify-between">
          <p className="font-semibold text-ink">গত ১২ মাসের আয়</p>
          <p className="text-xs text-muted">৳ হাজারে</p>
        </div>
        <div className="flex h-42.5 items-end gap-2.5">
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
        <p className="mb-3.5 font-semibold text-ink">সার্ভিস অনুযায়ী আয় (এই মাস)</p>
        {summary.byService.length === 0 ? (
          <p className="text-sm text-muted">এই মাসে এখনো কোনো সার্ভিস সম্পন্ন হয়নি।</p>
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
    </div>
  );
}
