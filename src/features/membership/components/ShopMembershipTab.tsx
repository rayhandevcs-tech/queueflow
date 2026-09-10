"use client";

import { useState } from "react";
import { CalendarClock, Crown } from "lucide-react";
import { useAuthGate } from "@/components/auth/AuthGate";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { StatusPill } from "@/components/ui/StatusPill";
import { useToast } from "@/components/ui/Toast";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { useMyMembershipActions, useMyMemberships } from "../hooks/use-memberships";
import { usePublicTiers } from "../hooks/use-tiers";
import { membershipDict } from "../lib/i18n";
import { daysLeft, effectiveStatus, findLiveMembership, soldAs, sortTiers } from "../lib/membership";
import { TierCard } from "./TierCard";

/**
 * Membership, as a customer sees it on a shop's page.
 *
 * A tab on the existing shop page rather than a route of its own: a
 * membership is a fact about *this shop*, and every other fact about this
 * shop — services, staff, reviews — is already a tab here. A new
 * `/memberships/[shopId]` page would have been a second way to reach the
 * same thing.
 *
 * The whole tab is hidden when the shop has no packages (decision 36), so the
 * shops that never run a programme are untouched by this sprint.
 *
 * Joining sends a *request*. There is no online payment in this app — the
 * gateway is a mock — so pretending to take money here would leave a
 * membership the shop had never been paid for. The customer sees plainly that
 * the owner activates it once they pay at the shop.
 */
export function ShopMembershipTab({ shopId }: { shopId: string }) {
  const t = useT(membershipDict);
  const showToast = useToast();
  // Browsing the packages needs no account; joining does. The app's existing
  // action-based gate decides that, the same way booking does.
  const { guard } = useAuthGate();
  const [now] = useState(() => new Date());
  const [leaving, setLeaving] = useState(false);

  const { data: tiers, isPending, isError } = usePublicTiers(shopId);
  const { data: myMemberships } = useMyMemberships();
  const { join, leave } = useMyMembershipActions();

  const mine = findLiveMembership(myMemberships ?? [], shopId, now);
  const ordered = sortTiers(tiers ?? []);

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

  if (ordered.length === 0) {
    return (
      <EmptyState
        icon={<Crown className="h-6 w-6" />}
        title={t("shopNoTiersTitle")}
        description={t("shopNoTiersDesc")}
      />
    );
  }

  const onJoin = guard((tierId: string) =>
    join.mutate({ shopId, tierId }, { onSuccess: () => showToast(t("joinRequestedToast")) }),
  );

  const status = mine ? effectiveStatus(mine, now) : null;
  const left = mine ? daysLeft(mine, now) : null;

  return (
    <div className="space-y-4">
      {/* ---- what I already have here ---- */}
      {mine && (
        <div className="space-y-2 rounded-2xl border border-accent/40 bg-accent/[0.06] p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-muted">{t("myMembershipHeading")}</p>
              <p className="truncate font-display text-[17px] font-bold text-ink">
                {soldAs(mine).name}
              </p>
            </div>
            <StatusPill
              tone={status === "ACTIVE" ? "good" : "brass"}
              dot={status === "ACTIVE"}
              label={t(`status${status}` as "statusACTIVE")}
            />
          </div>

          {status === "PENDING" ? (
            <div className="rounded-xl bg-card px-3 py-2.5">
              <p className="text-[13px] font-semibold text-ink">{t("joinPendingTitle")}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-muted">{t("joinPendingBody")}</p>
            </div>
          ) : (
            mine.expires_at && (
              <p className="flex items-center gap-1.5 text-[12px] text-muted">
                <CalendarClock className="h-3.5 w-3.5" />
                {formatBanglaDate(new Date(mine.expires_at))}
                {left !== null && <span>· {t("daysLeft", toBanglaDigits(left))}</span>}
              </p>
            )
          )}

          <button
            type="button"
            onClick={() => setLeaving(true)}
            className="text-[12px] font-semibold text-muted transition-colors hover:text-live"
          >
            {status === "PENDING" ? t("cancelRequestCta") : t("leaveMembershipCta")}
          </button>
        </div>
      )}

      <div>
        <h2 className="font-display text-base font-bold text-ink">{t("shopTiersHeading")}</h2>
        <p className="mt-1 text-[12px] leading-snug text-muted">{t("shopTiersIntro")}</p>
      </div>

      {join.isError && (
        <p className="text-sm text-live">
          {join.error instanceof Error ? join.error.message : t("loadFailed")}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {ordered.map((tier) => {
          const isMine = mine?.tier_id === tier.id;
          return (
            <TierCard
              key={tier.id}
              name={tier.name}
              description={tier.description}
              price={tier.price}
              durationDays={tier.duration_days}
              benefits={tier.benefits}
              highlight={isMine}
              footer={
                mine ? (
                  <p className="text-center text-[11px] text-muted">
                    {isMine ? t("myMembershipHeading") : t("cannotJoinTwice")}
                  </p>
                ) : (
                  <Button
                    onClick={() => onJoin(tier.id)}
                    loading={join.isPending}
                    className="w-full"
                  >
                    {t("joinCta")}
                  </Button>
                )
              }
            />
          );
        })}
      </div>

      {leaving && mine && (
        <ConfirmSheet
          open
          title={status === "PENDING" ? t("cancelRequestCta") : t("leaveTitle")}
          description={t("leaveBody")}
          confirmLabel={status === "PENDING" ? t("cancelRequestCta") : t("leaveMembershipCta")}
          cancelLabel={t("cancel")}
          loading={leave.isPending}
          onCancel={() => setLeaving(false)}
          onConfirm={() =>
            leave.mutate(
              { membershipId: mine.id, shopId },
              { onSuccess: () => setLeaving(false) },
            )
          }
        />
      )}
    </div>
  );
}
