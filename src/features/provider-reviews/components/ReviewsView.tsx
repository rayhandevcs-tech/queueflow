"use client";

import { Star } from "lucide-react";
import { formatBanglaDate } from "@/lib/format-wait";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useShopReviews } from "../hooks/use-shop-reviews";

function Stars({ count }: { count: number }) {
  return (
    <span className="text-brass">
      {"★".repeat(count)}
      <span className="opacity-25">{"★".repeat(5 - count)}</span>
    </span>
  );
}

export function ReviewsView({ shopId }: { shopId: string | undefined }) {
  const { reviews, namesBySerial, summary, isPending } = useShopReviews(shopId);

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-[27px] font-bold text-ink">কাস্টমার রিভিউ</h1>

      {summary.count === 0 ? (
        <EmptyState
          icon={<Star className="h-6 w-6" />}
          title="এখনো কোনো রিভিউ আসেনি"
          description="কাস্টমাররা সিরিয়াল শেষে রিভিউ দিলে এখানে দেখাবে।"
        />
      ) : (
        <>
          <div className="flex flex-col gap-4.5 sm:flex-row">
            <div className="shrink-0 rounded-[20px] bg-accent px-7.5 py-6 text-center text-accent-ink sm:w-44">
              <p className="font-number text-5xl font-bold">{summary.average}</p>
              <p className="mt-1 text-lg">★★★★★</p>
              <p className="mt-1.5 text-xs opacity-50">{summary.count} রিভিউ</p>
            </div>
            <div className="flex flex-1 flex-col justify-center gap-2 rounded-[20px] border border-line bg-card p-5">
              {summary.distribution.map((d) => (
                <div key={d.stars} className="flex items-center gap-2.5 text-xs">
                  <span className="w-6 shrink-0">{d.stars}★</span>
                  <div className="h-1.75 flex-1 rounded-full bg-soft">
                    <div
                      className="h-full rounded-full bg-brass"
                      style={{ width: `${Math.max(d.pct, d.count > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right font-number text-muted">{d.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {reviews.map((r) => {
              const name = namesBySerial[r.serial_id] ?? "কাস্টমার";
              return (
                <div key={r.id} className="rounded-2xl border border-line bg-card p-4.5">
                  <div className="mb-2 flex items-center gap-3">
                    <div
                      className="grid h-9.5 w-9.5 shrink-0 place-items-center rounded-xl font-display font-bold text-white"
                      style={{ background: shopAvatarColor(r.id) }}
                    >
                      {shopInitial(name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{name}</p>
                      <p className="text-[11px] text-muted">
                        {formatBanglaDate(new Date(r.created_at))}
                      </p>
                    </div>
                    <Stars count={r.rating} />
                  </div>
                  {r.comment && <p className="text-[13px] leading-relaxed text-ink">{r.comment}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
