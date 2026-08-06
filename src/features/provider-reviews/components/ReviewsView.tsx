"use client";

import { useMemo, useState } from "react";
import { BadgeCheck, EyeOff, ImageIcon, MessageSquare, Star } from "lucide-react";
import { formatBanglaDate } from "@/lib/format-wait";
import { cn } from "@/lib/utils";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import type { ReviewRow } from "@/lib/reviews";
import { useReviewReply, useShopReviews } from "../hooks/use-shop-reviews";
import { providerReviewsDict } from "../lib/i18n";

function Stars({ count }: { count: number }) {
  return (
    <span className="shrink-0 text-brass">
      {"★".repeat(count)}
      <span className="opacity-25">{"★".repeat(5 - count)}</span>
    </span>
  );
}

/**
 * The shop's right of reply.
 *
 * Until now a bad review sat on the shop's public page forever with no answer
 * beside it — which is the fastest way to turn an owner against the platform.
 * The reply is deliberately public and deliberately the only thing the owner
 * can write here: the rating and the customer's words stay untouchable.
 */
function ReplyBox({ review, shopId }: { review: ReviewRow; shopId: string | undefined }) {
  const t = useT(providerReviewsDict);
  const showToast = useToast();
  const reply = useReviewReply(shopId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.owner_reply ?? "");

  const save = (value: string | null) => {
    reply.mutate(
      { reviewId: review.id, reply: value },
      {
        onSuccess: () => {
          showToast(value ? t("replySavedToast") : t("replyDeletedToast"));
          setEditing(false);
        },
        onError: (err) => {
          const message = (err as { message?: string } | null)?.message ?? "";
          showToast(message.includes("reply_too_long") ? t("replyTooLong") : t("replyFailedToast"));
        },
      },
    );
  };

  if (!editing) {
    return review.owner_reply ? (
      <div className="mt-3 rounded-xl border-l-2 border-accent bg-soft px-3 py-2.5">
        <p className="text-[11px] font-semibold text-accent">{t("ownerReplyLabel")}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink">{review.owner_reply}</p>
        <button
          type="button"
          onClick={() => {
            setDraft(review.owner_reply ?? "");
            setEditing(true);
          }}
          className="mt-1.5 text-[11px] font-semibold text-muted hover:text-ink"
        >
          {t("replyEditCta")}
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => {
          setDraft("");
          setEditing(true);
        }}
        className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {t("replyCta")}
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t("replyPlaceholder")}
        rows={3}
        maxLength={600}
        autoFocus
        className="w-full resize-none rounded-[14px] border border-line bg-soft p-3.25 text-[13px] text-ink placeholder:text-muted"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={!draft.trim()}
          loading={reply.isPending}
          onClick={() => save(draft.trim())}
        >
          {t("replySaveCta")}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          {t("replyCancelCta")}
        </Button>
        {review.owner_reply && (
          <Button
            size="sm"
            variant="ghost"
            className="text-live"
            loading={reply.isPending}
            onClick={() => save(null)}
          >
            {t("replyDeleteCta")}
          </Button>
        )}
      </div>
    </div>
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

                    <ReplyBox review={r} shopId={shopId} />
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
