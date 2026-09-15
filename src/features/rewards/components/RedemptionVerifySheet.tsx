"use client";

import { useState } from "react";
import { CheckCircle2, Ticket } from "lucide-react";
import { parseRewardSnapshot, type RewardRedemption } from "@/types";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { formatBanglaDate, formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { useOpenBookings, useRedemptionVerify } from "../hooks/use-rewards";
import { rewardsDict } from "../lib/i18n";
import { isCodeShaped, normalizeCode, redemptionState } from "../lib/rewards";
import type { MarkUsedResult } from "../api/rewards.api";

/**
 * The counter flow: read a code, pick the job, take the money off.
 *
 * Three steps, and the split matters. Looking a code up **must not consume
 * it** — the owner needs to see whose coupon it is and what it is worth before
 * choosing which bill it lands on, and a lookup that burnt the coupon would be
 * unusable at a counter where people change their minds.
 *
 * The bookings are a list to pick from rather than an id to type, because the
 * server refuses a coupon applied to someone else's bill
 * (`redemption_wrong_customer`) and the owner should meet that rule as a
 * short list, not as an error.
 *
 * This lives on the rewards page rather than inside the queue's and the
 * parlour's payment sheets, deliberately: those belong to two other features
 * and reaching into both to add a coupon box would mean editing the payment
 * path twice over for a feature that works perfectly well as its own step.
 */
export function RedemptionVerifySheet({
  shopId,
  open,
  onClose,
}: {
  shopId: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT(rewardsDict);
  const [code, setCode] = useState("");
  const [shapeError, setShapeError] = useState<string | null>(null);
  const [found, setFound] = useState<RewardRedemption | null>(null);
  const [applied, setApplied] = useState<MarkUsedResult | null>(null);
  const [now] = useState(() => new Date());

  const { lookUp, consume } = useRedemptionVerify(shopId);
  const bookings = useOpenBookings(shopId, found?.customer_id);

  const num = (n: number) => toBanglaDigits(n);
  const snapshot = found ? parseRewardSnapshot(found.reward_snapshot) : null;
  const state = found ? redemptionState(found, now) : null;

  function reset() {
    setCode("");
    setShapeError(null);
    setFound(null);
    setApplied(null);
    lookUp.reset();
    consume.reset();
  }

  function close() {
    reset();
    onClose();
  }

  function submitCode() {
    const normalized = normalizeCode(code);
    if (!isCodeShaped(normalized)) {
      setShapeError(t("codeShapeError"));
      return;
    }
    setShapeError(null);
    lookUp.mutate(normalized, { onSuccess: (row) => setFound(row) });
  }

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title={
        <span className="flex items-center gap-1.5">
          <Ticket className="h-4 w-4 text-brass" />
          {t("verifyHeading")}
        </span>
      }
    >
      {/* ---- step 3: done ---- */}
      {applied ? (
        <div className="space-y-3">
          <div className="space-y-1.5 rounded-2xl border border-good/40 bg-good/[0.07] p-4">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <CheckCircle2 className="h-4 w-4 text-good" />
              {t("appliedTitle")}
            </p>
            <p className="text-[12px] leading-snug text-muted">
              {t(
                "appliedBody",
                formatMoney(applied.discountAmount),
                formatMoney(applied.billBefore),
                formatMoney(applied.billAfter),
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={reset} variant="outline" className="flex-1">
              {t("verifyCta")}
            </Button>
            <Button onClick={close} className="flex-1">
              {t("done")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          <p className="text-[12px] leading-snug text-muted">{t("verifyIntro")}</p>

          {/* ---- step 1: the code ---- */}
          <Field label={t("codeLabel")} error={shapeError ?? undefined}>
            <Input
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                setShapeError(null);
                setFound(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitCode();
                }
              }}
              placeholder={t("codePlaceholder")}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={12}
              invalid={!!shapeError}
              className="font-number tracking-[0.2em] uppercase"
            />
          </Field>

          {!found && (
            <Button onClick={submitCode} loading={lookUp.isPending} className="w-full">
              {lookUp.isPending ? t("lookingUp") : t("lookUp")}
            </Button>
          )}

          {/* A code that is not at this shop is not "wrong" — it does not
              exist here, which is what the message says. */}
          {lookUp.isSuccess && !found && (
            <p className="rounded-xl bg-soft px-3.5 py-3 text-[12px] leading-snug text-live">
              {t("couponNotFound")}
            </p>
          )}

          {/* ---- step 2: the coupon, and which bill ---- */}
          {found && snapshot && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-line bg-soft p-3.5">
                <p className="text-[11px] font-semibold text-muted">{t("couponFound")}</p>
                <p className="mt-0.5 font-display text-[16px] font-bold text-ink">
                  {snapshot.name}
                </p>
                <p className="text-[12px] text-muted">
                  {t("spentPoints", num(found.points_spent))}
                  {found.expires_at
                    ? ` · ${t("expiresOn", formatBanglaDate(new Date(found.expires_at)))}`
                    : ""}
                </p>
              </div>

              {state !== "USABLE" ? (
                <p className="rounded-xl bg-soft px-3.5 py-3 text-[12px] leading-snug text-brass">
                  {state === "USED" ? t("couponUsedAlready") : t("couponExpiredAlready")}
                </p>
              ) : (
                <>
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{t("pickBooking")}</p>
                    <p className="text-[11px] leading-snug text-muted">{t("pickBookingHint")}</p>
                  </div>

                  {bookings.isPending ? (
                    <div className="grid min-h-16 place-items-center">
                      <Spinner className="h-5 w-5 text-muted" />
                    </div>
                  ) : (bookings.data?.length ?? 0) === 0 ? (
                    <p className="rounded-xl bg-soft px-3.5 py-3 text-[12px] leading-snug text-muted">
                      {t("noOpenBooking")}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {bookings.data?.map((booking) => (
                        <li key={`${booking.type}-${booking.id}`}>
                          <button
                            type="button"
                            disabled={consume.isPending}
                            onClick={() =>
                              consume.mutate(
                                {
                                  code: found.code,
                                  bookingType: booking.type,
                                  bookingId: booking.id,
                                },
                                { onSuccess: setApplied },
                              )
                            }
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-3 text-left transition-colors",
                              consume.isPending
                                ? "opacity-60"
                                : "hover:border-accent/40 hover:bg-soft",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-semibold text-ink">
                                {booking.type === "SERIAL"
                                  ? t("bookingSerial")
                                  : t("bookingAppointment")}
                              </p>
                              <p className="truncate text-[11px] text-muted">
                                {formatBanglaDate(new Date(booking.at))}
                              </p>
                            </div>
                            <span className="shrink-0 font-display text-[14px] font-bold text-ink">
                              {formatMoney(booking.totalAmount)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {(lookUp.isError || consume.isError) && (
            <p className="text-[12px] text-live">
              {errorText(lookUp.error ?? consume.error, t("loadFailed"))}
            </p>
          )}

          <Button type="button" variant="outline" onClick={close} className="w-full">
            {t("cancel")}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}

/**
 * Supabase rejects with a plain object, not an Error, so the obvious
 * `instanceof Error` check throws away the only readable part. The mutation
 * layer has already turned it into a `UiDbError`, but a raw rejection can
 * still reach here if something new slips past `withDbErrors`.
 */
function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
