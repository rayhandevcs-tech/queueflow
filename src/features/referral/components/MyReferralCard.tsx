"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Gift, Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { useToast } from "@/components/ui/Toast";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format-wait";
import { useLanguage, useT } from "@/lib/i18n";
import { toWhatsAppShareLink } from "@/lib/phone";
import { useMyReferralCode, useMyReferrals, useReferralActions } from "../hooks/use-referral";
import { referralDict } from "../lib/i18n";
import { isConverted, shareMessage, sortReferrals, summarizeReferrals } from "../lib/referral";

/**
 * The customer's own code, and who has used it.
 *
 * The code is **minted on a tap, never on a render**. A query that created a
 * row as a side effect of opening a tab would give a code to every customer
 * who ever browsed the shop — thousands of rows nobody asked for. So the read
 * hook looks for an existing code, and only the button writes one.
 *
 * Sharing goes out through the app's existing WhatsApp deep-link pattern, with
 * no recipient: the customer does not yet know which friend will use the code,
 * so WhatsApp asks. The copy button is the fallback for anyone without it.
 */
export function MyReferralCard({
  shopId,
  shopName,
  referrerPoints,
  referredPoints,
  signedIn,
  onRequireLogin,
}: {
  shopId: string;
  shopName: string;
  referrerPoints: number;
  referredPoints: number;
  signedIn: boolean;
  onRequireLogin: () => void;
}) {
  const t = useT(referralDict);
  const { language } = useLanguage();
  const showToast = useToast();
  const [copied, setCopied] = useState(false);

  // Both reads are for the signed-in customer's own rows, so a guest asks for
  // neither — RLS would return nothing anyway, and a guest has no rows to have.
  const { data: code } = useMyReferralCode(shopId, signedIn);
  const { data: mine } = useMyReferrals(shopId, signedIn);
  const { mintCode } = useReferralActions(shopId);

  const rows = useMemo(() => sortReferrals(mine ?? []), [mine]);
  const summary = useMemo(() => summarizeReferrals(mine ?? []), [mine]);
  const num = (n: number) => toBanglaDigits(n);

  const shown = code ?? mintCode.data ?? null;

  const message = shown
    ? shareMessage({
        shopName,
        code: shown,
        referredPoints,
        lang: language === "en" ? "en" : "bn",
      })
    : "";

  async function copy() {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access is refused outright in some in-app browsers. Saying
      // so beats a button that silently does nothing.
      showToast(t("copyFailed"));
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-accent/35 bg-accent/[0.06] p-4">
      <div>
        <p className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
          <Gift className="h-4 w-4 text-accent" />
          {t("shareHeading")}
        </p>
        <p className="mt-1 text-[12px] leading-snug text-muted">
          {referredPoints > 0
            ? t("shareIntro", num(referrerPoints), num(referredPoints))
            : t("shareIntroReferrerOnly", num(referrerPoints))}
        </p>
      </div>

      {!signedIn ? (
        <Button onClick={onRequireLogin} className="w-full">
          {t("loginToShare")}
        </Button>
      ) : shown ? (
        <>
          <div className="rounded-xl bg-card px-3.5 py-3 text-center">
            <p className="text-[11px] font-semibold text-muted">{t("myCodeLabel")}</p>
            <p className="mt-0.5 font-number text-[26px] leading-none font-bold tracking-[0.2em] text-ink">
              {shown}
            </p>
            <p className="mt-1.5 text-[11px] leading-snug text-muted">{t("codeHint")}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={toWhatsAppShareLink(message)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-good px-3.5 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              <WhatsAppIcon className="h-4 w-4" />
              {t("shareOnWhatsApp")}
            </a>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card px-3.5 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:bg-soft"
            >
              {copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />}
              {copied ? t("copied") : t("copyCode")}
            </button>
          </div>
        </>
      ) : (
        <>
          <Button
            onClick={() => mintCode.mutate()}
            loading={mintCode.isPending}
            className="w-full"
          >
            {mintCode.isPending ? t("gettingCode") : t("getCode")}
          </Button>
          {mintCode.isError && (
            <p className="text-[12px] text-live">
              {mintCode.error instanceof Error ? mintCode.error.message : t("codeFailed")}
            </p>
          )}
        </>
      )}

      {/* ---- who used it ---- */}
      {signedIn && shown && (
        <div className="space-y-2 border-t border-line/70 pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
              {t("myListHeading")}
            </p>
            {summary.total > 0 && (
              <p className="text-[11px] text-muted">
                {t("myTotals", num(summary.converted), num(summary.total))}
              </p>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="text-[12px] leading-snug text-muted">{t("myListEmpty")}</p>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((row) => {
                const came = isConverted(row.status);
                return (
                  <li
                    key={row.id}
                    className="flex items-center gap-2.5 rounded-xl bg-card px-3 py-2"
                  >
                    <Share2 className="h-3.5 w-3.5 shrink-0 text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">
                        {row.referredName}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {came
                          ? formatBanglaDate(new Date(row.convertedAt ?? row.createdAt))
                          : t("pendingHint")}
                      </p>
                    </div>
                    {came ? (
                      <span className="shrink-0 font-display text-[13px] font-bold text-accent">
                        {t("earnedPoints", num(row.pointsEarned))}
                      </span>
                    ) : (
                      <StatusPill tone="brass" dot={false} label={t("statusPending")} />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
