"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, X } from "lucide-react";
import { keys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { submitReview } from "../api/review.api";

const RATING_LABELS = ["", "খুব খারাপ", "খারাপ", "মোটামুটি", "ভালো", "চমৎকার!"];

export function ReviewDialog({
  shopId,
  serialId,
  shopName,
  shopAvatarBg,
  shopInitial,
  onClose,
}: {
  shopId: string;
  serialId: string;
  shopName: string;
  shopAvatarBg: string;
  shopInitial: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const showToast = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  const submit = useMutation({
    mutationFn: submitReview,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.reviews.mine() });
      showToast("🙏 রিভিউয়ের জন্য ধন্যবাদ!");
      onClose();
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : "রিভিউ দেওয়া যায়নি — আবার চেষ্টা করো।");
    },
  });

  const displayRating = hoverRating || rating;

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-card p-5">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-muted hover:bg-soft hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center">
          <div
            className="mx-auto grid h-16 w-16 place-items-center rounded-[20px] font-display text-2xl font-extrabold text-white"
            style={{ background: shopAvatarBg }}
          >
            {shopInitial}
          </div>
          <p className="mt-3 font-display text-xl font-bold text-ink">{shopName} কেমন ছিল?</p>
          <p className="mt-0.5 text-[13px] text-muted">তোমার রিভিউ দোকানের অথেন্টিসিটি বাড়াবে</p>
        </div>

        <div className="my-6.5 flex justify-center gap-2.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              className="transition-transform hover:scale-115"
            >
              <Star
                className="h-9.5 w-9.5"
                style={{
                  color: n <= displayRating ? "var(--color-brass)" : "var(--color-line)",
                  fill: n <= displayRating ? "var(--color-brass)" : "transparent",
                }}
              />
            </button>
          ))}
        </div>

        <p className={cn("h-5 text-center font-semibold text-accent", !displayRating && "opacity-0")}>
          {RATING_LABELS[displayRating] || "…"}
        </p>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="অভিজ্ঞতা লিখো (ঐচ্ছিক)…"
          rows={3}
          className="mt-4.5 w-full resize-none rounded-[14px] border border-line bg-soft p-3.25 text-[13px] text-ink placeholder:text-muted"
        />

        <button
          type="button"
          disabled={rating === 0 || submit.isPending}
          onClick={() => submit.mutate({ shopId, serialId, rating, comment })}
          className="mt-3.5 w-full rounded-[15px] bg-accent py-3.75 font-display text-[15px] font-bold text-accent-ink disabled:opacity-50"
        >
          {submit.isPending ? "পাঠানো হচ্ছে…" : "রিভিউ সাবমিট করো"}
        </button>
      </div>
    </div>
  );
}
