"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Star, X } from "lucide-react";
import { keys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import { getBrowserClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import { uploadReviewImage } from "../api/review-storage.api";
import { submitReview } from "../api/review.api";
import { customerProfileDict } from "../lib/i18n";

const MAX_IMAGES = 4;

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
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const t = useT(customerProfileDict);

  const RATING_LABELS = ["", t("ratingWorst"), t("ratingBad"), t("ratingOkay"), t("ratingGood"), t("ratingGreat")];

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
  }, []);

  const submit = useMutation({
    mutationFn: submitReview,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.reviews.mine() });
      showToast(t("reviewThanks"));
      onClose();
    },
    onError: (err) => {
      showToast(err instanceof Error ? err.message : t("reviewSubmitFailed"));
    },
  });

  const onPickImage = async (file: File | undefined) => {
    if (!file || !myId) return;
    setUploadingImage(true);
    try {
      const url = await uploadReviewImage(myId, file);
      setImages((prev) => [...prev, url]);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("imageUploadFailed"));
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

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
          <p className="mt-3 font-display text-xl font-bold text-ink">{t("howWasShop", shopName)}</p>
          <p className="mt-0.5 text-[13px] text-muted">{t("reviewBoostsAuthenticity")}</p>
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
          placeholder={t("commentPlaceholder")}
          rows={3}
          className="mt-4.5 w-full resize-none rounded-[14px] border border-line bg-soft p-3.25 text-[13px] text-ink placeholder:text-muted"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((url) => (
            <div key={url} className="relative h-14 w-14 overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                className="absolute top-0.5 right-0.5 grid h-4.5 w-4.5 place-items-center rounded-full bg-ink/60 text-white"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingImage}
              className="grid h-14 w-14 place-items-center rounded-xl border-2 border-dashed border-line text-muted hover:border-accent/50"
            >
              {uploadingImage ? <Spinner className="h-4 w-4" /> : <ImagePlus className="h-5 w-5" />}
            </button>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPickImage(e.target.files?.[0])}
          />
        </div>

        <button
          type="button"
          disabled={rating === 0 || submit.isPending}
          onClick={() => submit.mutate({ shopId, serialId, rating, comment, images })}
          className="mt-3.5 w-full rounded-[15px] bg-accent py-3.75 font-display text-[15px] font-bold text-accent-ink disabled:opacity-50"
        >
          {submit.isPending ? t("submitting") : t("submitReview")}
        </button>
      </div>
    </div>
  );
}
