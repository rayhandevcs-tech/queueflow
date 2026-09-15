"use client";

import { useState } from "react";
import { CheckCircle2, Ticket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { useMyClaimedReferral, useReferralActions } from "../hooks/use-referral";
import { referralDict } from "../lib/i18n";
import { hasAmbiguousChar, isCodeShaped, normalizeCode } from "../lib/referral";

/**
 * Where a newcomer types someone else's code.
 *
 * It sits on the shop's page, above the booking flow — which is the whole
 * reason the codes are shop-scoped. A global code would have had to be
 * collected at sign-up, where there is no shop to attach it to, and that
 * would have meant either redesigning the auth flow or inventing a "code held
 * in escrow" state. Here the claim happens where the shop is already known.
 *
 * **Applying a code awards nothing.** The card says so plainly, because a
 * customer who thought points had landed and then found none would rightly
 * feel cheated. The points arrive when their first job here is finished.
 */
export function ReferralClaimCard({
  shopId,
  referredPoints,
  signedIn,
  onRequireLogin,
}: {
  shopId: string;
  referredPoints: number;
  signedIn: boolean;
  onRequireLogin: () => void;
}) {
  const t = useT(referralDict);
  const [code, setCode] = useState("");
  const [shapeError, setShapeError] = useState<string | null>(null);

  const { data: claimed } = useMyClaimedReferral(shopId, signedIn);
  const { claim } = useReferralActions(shopId);

  const num = (n: number) => toBanglaDigits(n);

  // ---- already arrived on someone's code ----
  if (claimed) {
    const paid = claimed.status === "CONVERTED";
    return (
      <section className="space-y-1.5 rounded-2xl border border-good/40 bg-good/[0.07] p-4">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <CheckCircle2 className="h-4 w-4 text-good" />
          {paid ? t("claimedAndPaidTitle") : t("claimedTitle")}
        </p>
        {!paid && (
          <p className="text-[12px] leading-snug text-muted">
            {referredPoints > 0
              ? t("claimedBody", num(referredPoints))
              : t("claimedBodyNoBonus")}
          </p>
        )}
        {paid && (claimed.referred_points ?? 0) > 0 && (
          <p className="font-display text-[15px] font-bold text-accent">
            {t("earnedPoints", num(claimed.referred_points ?? 0))}
          </p>
        )}
      </section>
    );
  }

  function submit() {
    const normalized = normalizeCode(code);

    // A round trip for something the CHECK constraint will certainly refuse
    // is a round trip that only buys a slower "not found".
    if (!isCodeShaped(normalized)) {
      setShapeError(t("claimShapeError"));
      return;
    }
    // 0/O/1/I/L are never minted, so one of them almost always means a
    // misread rather than a wrong code. Worth saying before the server says
    // "not found" and sends them looking for the wrong problem.
    if (hasAmbiguousChar(normalized)) {
      setShapeError(t("claimAmbiguousHint"));
      return;
    }

    setShapeError(null);
    claim.mutate(normalized);
  }

  return (
    <section className="space-y-2.5 rounded-2xl border border-line bg-card p-4">
      <div>
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <Ticket className="h-4 w-4 text-brass" />
          {t("claimHeading")}
        </p>
        <p className="mt-1 text-[12px] leading-snug text-muted">
          {referredPoints > 0 ? t("claimIntro", num(referredPoints)) : t("claimIntroNoBonus")}
        </p>
      </div>

      {signedIn ? (
        <>
          <Field
            label={t("claimCodeLabel")}
            error={shapeError ?? (claim.isError ? errorText(claim.error, t("loadFailed")) : undefined)}
          >
            <Input
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                setShapeError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder={t("claimCodePlaceholder")}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={12}
              invalid={!!shapeError || claim.isError}
              className="font-number tracking-[0.2em] uppercase"
            />
          </Field>
          <Button onClick={submit} loading={claim.isPending} className="w-full">
            {claim.isPending ? t("claimSubmitting") : t("claimSubmit")}
          </Button>
        </>
      ) : (
        <Button variant="outline" onClick={onRequireLogin} className="w-full">
          {t("loginToShare")}
        </Button>
      )}
    </section>
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
