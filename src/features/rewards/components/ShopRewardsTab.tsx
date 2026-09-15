"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Gift, Sparkles } from "lucide-react";
import type { Reward, Service } from "@/types";
import { cn } from "@/lib/utils";
import { useAuthGate } from "@/components/auth/AuthGate";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { StatusPill } from "@/components/ui/StatusPill";
import { useToast } from "@/components/ui/Toast";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { useMyBalanceAtShop, usePublicRewards, useRedeemReward } from "../hooks/use-rewards";
import { rewardsDict } from "../lib/i18n";
import { canRedeem, pointsShort, sortRewards } from "../lib/rewards";
import type { RedeemResult } from "../api/rewards.api";

/**
 * Rewards, as a customer sees them on a shop's page.
 *
 * A tab on the existing shop page rather than a route of its own, for the
 * reason membership and referral are: a reward is a fact about *this shop*,
 * and every other fact about this shop is already a tab here.
 *
 * **The balance shown is this shop's balance, never a total.** That is the
 * single most important thing about this screen. Fifty points buys something
 * at the shop that gave them and nothing anywhere else (decision 33), so a
 * merged figure sitting next to a price would be an actively misleading
 * number — and the customer would be entitled to feel cheated when the server
 * refused. The heading says so in words as well.
 */
export function ShopRewardsTab({
  shopId,
  services,
}: {
  shopId: string;
  /** For naming the service a FREE_SERVICE reward gives away. */
  services: Service[] | undefined;
}) {
  const t = useT(rewardsDict);
  const showToast = useToast();
  // Browsing the shelf needs no account; spending points does. The app's
  // existing action-based gate decides that, exactly as booking does.
  const { signedIn, guard } = useAuthGate();
  const requireLogin = guard(() => {});

  const [issued, setIssued] = useState<RedeemResult | null>(null);
  const [copied, setCopied] = useState(false);
  // One clock reading per mount: a reward must not read "expired" and
  // "available" on two renders of the same second.
  const [now] = useState(() => new Date());

  const { data: rewards, isPending, isError } = usePublicRewards(shopId);
  const { data: balance } = useMyBalanceAtShop(shopId, signedIn);
  const redeem = useRedeemReward(shopId);

  const rows = useMemo(() => sortRewards(rewards ?? []), [rewards]);
  const num = (n: number) => toBanglaDigits(n);
  const serviceName = (id: string | null) =>
    services?.find((service) => service.id === id)?.name ?? "";

  const worth = (reward: Reward) => {
    if (reward.kind === "DISCOUNT_FLAT") return t("valueFlat", num(reward.value ?? 0));
    if (reward.kind === "DISCOUNT_PCT") return t("valuePct", num(reward.value ?? 0));
    return t("valueFree", serviceName(reward.service_id));
  };

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast(t("copyFailed"));
    }
  }

  if (isPending) {
    return (
      <div className="grid min-h-32 place-items-center">
        <Spinner className="h-5 w-5 text-muted" />
      </div>
    );
  }

  if (isError) {
    return <p className="py-8 text-center text-sm text-live">{t("loadFailed")}</p>;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Gift className="h-6 w-6" />}
        title={t("shopNoRewards")}
        description={t("shopNoRewardsDesc")}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ---- the coupon just issued ---- */}
      {issued && (
        <section className="space-y-2.5 rounded-2xl border border-good/40 bg-good/[0.07] p-4">
          <p className="flex items-center gap-1.5 font-display text-base font-bold text-ink">
            <Check className="h-4 w-4 text-good" />
            {t("redeemedTitle")}
          </p>
          <div className="rounded-xl bg-card px-3.5 py-3 text-center">
            <p className="font-number text-[26px] leading-none font-bold tracking-[0.2em] text-ink">
              {issued.code}
            </p>
            {issued.validUntil && (
              <p className="mt-1 text-[11px] text-muted">
                {t("expiresOn", formatBanglaDate(new Date(issued.validUntil)))}
              </p>
            )}
          </div>
          <p className="text-[12px] leading-snug text-muted">{t("redeemedBody")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => copy(issued.code)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3.5 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-soft"
            >
              {copied ? <Check className="h-4 w-4 text-good" /> : <Copy className="h-4 w-4" />}
              {copied ? t("copied") : t("copyCode")}
            </button>
            <span className="text-[12px] text-muted">
              {t("redeemedBalance", num(issued.balanceAfter))}
            </span>
          </div>
        </section>
      )}

      {/* ---- this shop's balance, and only this shop's ---- */}
      <div className="rounded-2xl border border-line bg-soft p-3.5">
        <p className="font-display text-base font-bold text-ink">{t("shopHeading")}</p>
        {signedIn ? (
          <>
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold text-accent">
              <Sparkles className="h-3.5 w-3.5" />
              {t("myBalanceHere", num(balance ?? 0))}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted">
              {(balance ?? 0) > 0 ? t("balanceShopOnly") : t("noBalanceYet")}
            </p>
          </>
        ) : (
          <p className="mt-0.5 text-[11px] leading-snug text-muted">{t("balanceShopOnly")}</p>
        )}
      </div>

      {redeem.isError && (
        <p className="text-sm text-live">{errorText(redeem.error, t("redeemFailed"))}</p>
      )}

      {/* ---- the shelf ---- */}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map((reward) => {
          const verdict = canRedeem(reward, balance ?? 0, now);
          const short = pointsShort(reward, balance ?? 0);
          return (
            <li
              key={reward.id}
              className={cn(
                "flex flex-col gap-2.5 rounded-2xl border bg-card p-4",
                verdict.ok ? "border-accent/35" : "border-line",
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-display text-[16px] font-bold text-ink">
                  {reward.name}
                </p>
                <p className="text-[12px] font-semibold text-accent">{worth(reward)}</p>
                {reward.description && (
                  <p className="mt-1 text-[11px] leading-snug text-muted">
                    {reward.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                <span className="rounded-full bg-soft px-2.5 py-0.5 font-semibold text-ink">
                  {t("costLabel", num(reward.points_cost))}
                </span>
                {reward.stock != null && <span>{t("stockLeft", num(reward.stock))}</span>}
                {reward.valid_until && (
                  <span>{t("validTill", formatBanglaDate(new Date(reward.valid_until)))}</span>
                )}
              </div>

              <div className="mt-auto">
                {!signedIn ? (
                  <Button variant="outline" onClick={requireLogin} className="w-full">
                    {t("loginToRedeem")}
                  </Button>
                ) : verdict.ok ? (
                  <Button
                    onClick={() =>
                      redeem.mutate(reward.id, {
                        onSuccess: (result) => {
                          setIssued(result);
                          setCopied(false);
                        },
                      })
                    }
                    loading={redeem.isPending}
                    className="w-full"
                  >
                    {redeem.isPending ? t("redeeming") : t("redeem")}
                  </Button>
                ) : (
                  // The disabled state and the sentence explaining it come
                  // from the same function, so they can never disagree.
                  <div className="flex items-center justify-center">
                    <StatusPill
                      tone={verdict.block === "NOT_ENOUGH_POINTS" ? "brass" : "neutral"}
                      dot={false}
                      label={
                        verdict.block === "NOT_ENOUGH_POINTS"
                          ? t("blockNOT_ENOUGH_POINTS", num(short))
                          : t(`block${verdict.block}` as "blockOUT_OF_STOCK")
                      }
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
