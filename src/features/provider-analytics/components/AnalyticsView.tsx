"use client";

import { Spinner } from "@/components/ui/Spinner";
import { useAnalyticsSummary } from "../hooks/use-analytics-summary";
import type { LoadBucket } from "../lib/compute-analytics";

const INSIGHT_DOT_COLORS = ["var(--color-live)", "var(--color-good)", "var(--color-brass)"];

function HourlyBars({ buckets }: { buckets: LoadBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="flex h-40 items-end gap-2">
      {buckets.map((b) => {
        const intensity = b.count / max;
        return (
          <div key={b.short} className="flex h-full flex-1 flex-col items-center justify-end gap-1.75">
            <div className="relative w-full max-w-9.5" style={{ height: `${Math.max(3, intensity * 100)}%` }}>
              {b.isPeak && (
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-live">
                  পিক
                </span>
              )}
              <div
                className="h-full w-full rounded-t-[7px] border border-line"
                style={{
                  background: b.isPeak
                    ? "var(--color-live)"
                    : `color-mix(in srgb, var(--color-accent) ${Math.round(intensity * 70)}%, var(--color-soft))`,
                }}
              />
            </div>
            <span className={b.isPeak ? "text-[10px] font-semibold text-ink" : "text-[10px] text-muted"}>
              {b.short}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function WeeklyBars({ buckets }: { buckets: LoadBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="flex h-30 items-end gap-2.25">
      {buckets.map((b) => (
        <div key={b.short} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
          <div
            className="w-full rounded-t-md"
            style={{
              height: `${Math.max(3, (b.count / max) * 100)}%`,
              background: b.isPeak ? "var(--color-accent)" : "var(--color-brass-soft)",
            }}
          />
          <span className={b.isPeak ? "text-[10px] font-semibold text-ink" : "text-[10px] text-muted"}>
            {b.short}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsView({ shopId }: { shopId: string | undefined }) {
  const { summary, isPending } = useAnalyticsSummary(shopId);

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4.5">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">কাস্টমার অ্যানালিটিক্স</h1>
        <p className="mt-1 text-sm text-muted">
          কখন কেমন চাপ থাকে বুঝে নাও — কর্মী ও সময় পরিকল্পনা করো
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-card p-4.5">
          <p className="text-xs text-muted">দৈনিক গড় কাস্টমার</p>
          <p className="mt-1 font-number text-[28px] font-bold text-ink">
            {summary.dailyAvgCustomers ?? "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4.5">
          <p className="text-xs text-muted">পিক টাইম</p>
          <p className="mt-1 text-lg font-bold text-live">
            {summary.peakHourLabel ?? (summary.hasData ? "সকাল ৮টার আগে" : "এখনো নেই")}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4.5">
          <p className="text-xs text-muted">গড় সার্ভিস সময়</p>
          <p className="mt-1 font-number text-[28px] font-bold text-ink">
            {summary.avgServiceMin ?? "—"}
            {summary.avgServiceMin !== null && <span className="text-sm">মি</span>}
          </p>
        </div>
      </div>

      {!summary.hasData ? (
        <div className="rounded-2xl border border-dashed border-line bg-card p-8.5 text-center text-sm text-muted">
          এখনো যথেষ্ট কাজ সম্পন্ন হয়নি — কাজ চলতে থাকলে এখানে সময়ভিত্তিক চাপ আর ইনসাইট দেখা যাবে।
        </div>
      ) : (
        <>
          <div className="rounded-[20px] border border-line bg-card p-5.5">
            <p className="mb-4 font-semibold text-ink">সময় অনুযায়ী কাস্টমার চাপ (গত ৯০ দিন)</p>
            <HourlyBars buckets={summary.hourlyLoad} />
          </div>

          <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-2">
            <div className="rounded-[20px] border border-line bg-card p-5.5">
              <p className="mb-4 font-semibold text-ink">সাপ্তাহিক চাপ</p>
              <WeeklyBars buckets={summary.weeklyLoad} />
            </div>
            <div className="rounded-[20px] border border-line bg-card p-5.5">
              <p className="mb-3.5 font-semibold text-ink">ইনসাইট</p>
              {summary.insights.length === 0 ? (
                <p className="text-sm text-muted">এখনো ইনসাইট তৈরি করার মতো ডেটা নেই।</p>
              ) : (
                <div className="flex flex-col">
                  {summary.insights.map((text, i) => (
                    <div
                      key={i}
                      className={`flex gap-2.5 py-2.5 text-[13px] text-ink ${i > 0 ? "border-t border-line" : ""}`}
                    >
                      <span style={{ color: INSIGHT_DOT_COLORS[i % INSIGHT_DOT_COLORS.length] }}>●</span>
                      {text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
