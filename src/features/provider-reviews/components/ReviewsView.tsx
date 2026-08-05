"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, EyeOff, ImageIcon, Star } from "lucide-react";
import { formatBanglaDate } from "@/lib/format-wait";
import { cn } from "@/lib/utils";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import { useShopReviews } from "../hooks/use-shop-reviews";
import { providerReviewsDict } from "../lib/i18n";

function Stars({ count }: { count: number }) {
  return (
    <span className="shrink-0 text-brass">
      {"★".repeat(count)}
      <span className="opacity-25">{"★".repeat(5 - count)}</span>
    </span>
  );
}

type Filter = "latest" | "with-images";

export function ReviewsView({ shopId }: { shopId: string | undefined }) {
  const { reviews, customerInfoBySerial, staffNameByChairId, summary, isPending } = useShopReviews(shopId);
  const [filter, setFilter] = useState<Filter>("latest");
  const t = useT(providerReviewsDict);

  const visibleReviews = useMemo(
    () => (filter === "with-images" ? reviews.filter((r) => r.images.length > 0) : reviews),
    [reviews, filter],
  );

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-[27px] font-bold text-ink">{t("customerReviewsTitle")}</h1>

      {summary.count === 0 ? (
        <EmptyState
          icon={<Star className="h-6 w-6" />}
          title={t("noReviewsTitle")}
          description={t("noReviewsDesc")}
        />
      ) : (
        <>
          <div className="flex flex-col gap-4.5 sm:flex-row">
            <div className="shrink-0 rounded-[20px] bg-accent px-7.5 py-6 text-center text-accent-ink sm:w-44">
              <p className="font-number text-5xl font-bold">{summary.average}</p>
              <p className="mt-1 text-lg">★★★★★</p>
              <p className="mt-1.5 text-xs opacity-50">{t("reviewCountSuffix", summary.count)}</p>
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
              {visibleReviews.map((r) => {
                const info = customerInfoBySerial[r.serial_id];
                const name = info?.name ?? t("customerFallback");
                return (
                  <div
                    key={r.id}
                    className={cn(
                      "rounded-2xl border border-line bg-card p-4.5",
                      // Hidden reviews still reach the owner (their own RLS
                      // policy is untouched) — dim them so it's obvious the
                      // public no longer sees this one.
                      r.hidden_at && "border-dashed opacity-60",
                    )}
                  >
                    <div className="mb-2 flex items-center gap-3">
                      <AvatarChip label={name} avatarUrl={info?.avatarUrl} shape="circle" size={38} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-ink">{name}</p>
                          <span
                            title={t("verifiedTitle")}
                            className="flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-good"
                          >
                            <BadgeCheck className="h-3 w-3" />
                            {t("verifiedBadge")}
                          </span>
                          {r.hidden_at && (
                            <span
                              title={t("hiddenTitle")}
                              className="flex shrink-0 items-center gap-0.5 rounded-full bg-soft px-2 py-0.5 text-[10px] font-semibold text-muted"
                            >
                              <EyeOff className="h-3 w-3" />
                              {t("hiddenBadge")}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted">
                          {formatBanglaDate(new Date(r.created_at))}
                          {r.chair_id && staffNameByChairId[r.chair_id] && (
                            <> · {staffNameByChairId[r.chair_id]}</>
                          )}
                        </p>
                      </div>
                      <Stars count={r.rating} />
                    </div>
                    {r.comment && <p className="text-[13px] leading-relaxed text-ink">{r.comment}</p>}
                    {r.images.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {r.images.map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
