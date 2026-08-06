"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, ImageIcon, Star } from "lucide-react";
import { formatBanglaDate } from "@/lib/format-wait";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReportButton } from "@/components/ui/ReportButton";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import { useShopChairs } from "../hooks/use-shop-detail";
import { useShopReviewsPublic } from "../hooks/use-shop-reviews-public";
import { customerBookingDict } from "../lib/i18n";

function Stars({ count }: { count: number }) {
  return (
    <span className="text-brass">
      {"★".repeat(count)}
      <span className="opacity-25">{"★".repeat(5 - count)}</span>
    </span>
  );
}

type Filter = "latest" | "with-images";

export function ReviewsTab({ shopId }: { shopId: string }) {
  const { reviews, summary, isPending } = useShopReviewsPublic(shopId);
  const { data: chairs } = useShopChairs(shopId);
  const [filter, setFilter] = useState<Filter>("latest");
  const t = useT(customerBookingDict);

  const staffNameByChairId = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of chairs ?? []) map.set(c.id, c.staff_name || c.label);
    return map;
  }, [chairs]);

  const visibleReviews = useMemo(
    () => (filter === "with-images" ? reviews.filter((r) => r.images.length > 0) : reviews),
    [reviews, filter],
  );

  if (isPending) {
    return (
      <div className="grid min-h-32 place-items-center">
        <Spinner className="h-5 w-5 text-muted" />
      </div>
    );
  }

  if (summary.count === 0) {
    return (
      <EmptyState
        icon={<Star className="h-6 w-6" />}
        title={t("noReviewsTitle")}
        description={t("noReviewsDesc")}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4.5 sm:flex-row">
        <div className="shrink-0 rounded-[18px] bg-accent px-7.5 py-6 text-center text-accent-ink sm:w-44">
          <p className="font-number text-5xl font-bold">{summary.average}</p>
          <p className="mt-1 text-lg">★★★★★</p>
          <p className="mt-1.5 text-xs opacity-50">{t("reviewCountSuffix", summary.count)}</p>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-2 rounded-[18px] border border-line bg-card p-5">
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

      <div className="flex gap-2">
        {(
          [
            ["latest", t("latestFilter")],
            ["with-images", t("withImagesFilter")],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              filter === key ? "bg-accent text-accent-ink" : "bg-soft text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {visibleReviews.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-6 w-6" />}
          title={t("noImageReviewsTitle")}
          description={t("noImageReviewsDesc")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visibleReviews.map((r) => (
            <div key={r.id} className="rounded-2xl border border-line bg-card p-4.5">
              <div className="mb-2 flex items-center gap-3">
                <div className="grid h-9.5 w-9.5 shrink-0 place-items-center rounded-xl bg-soft font-display font-bold text-muted">
                  ?
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-ink">{t("customerFallback")}</p>
                    <span
                      title={t("verifiedTitle")}
                      className="flex items-center gap-0.5 text-[10px] font-medium text-good"
                    >
                      <BadgeCheck className="h-3 w-3" />
                      {t("verifiedBadge")}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">
                    {formatBanglaDate(new Date(r.created_at))}
                    {r.chair_id && staffNameByChairId.get(r.chair_id) && (
                      <> · {staffNameByChairId.get(r.chair_id)}</>
                    )}
                  </p>
                </div>
                <Stars count={r.rating} />
                <ReportButton targetType="REVIEW" targetId={r.id} />
              </div>
              {r.comment && <p className="text-[13px] leading-relaxed text-ink">{r.comment}</p>}
              {r.images.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {r.images.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
              {/* The shop's answer, right under the review it answers — a
                  complaint and its resolution belong in the same glance. */}
              {r.owner_reply && (
                <div className="mt-2.5 rounded-xl border-l-2 border-accent bg-soft px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-accent">{t("ownerReplyLabel")}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink">{r.owner_reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
