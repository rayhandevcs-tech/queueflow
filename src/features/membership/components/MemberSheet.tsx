"use client";

import { useState } from "react";
import { CalendarClock, Coins, Crown, UserRound } from "lucide-react";
import type { CustomerMembership } from "@/types";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatBanglaDate, formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { membershipDict } from "../lib/i18n";
import { daysLeft, effectiveStatus, isTerminal, soldAs } from "../lib/membership";
import type { useMembershipActions } from "../hooks/use-memberships";
import { MembershipPaymentSheet } from "./MembershipPaymentSheet";

/**
 * One membership, and what the owner can do to it next.
 *
 * The buttons come from the status machine mirror, so the sheet never offers a
 * transition the database would refuse. A terminal membership offers nothing —
 * renewing is a new row, which is what keeps each row's snapshot honest about
 * one purchase.
 */
export function MemberSheet({
  membership,
  shopId,
  actions,
  onClose,
}: {
  membership: CustomerMembership;
  shopId: string;
  actions: ReturnType<typeof useMembershipActions>;
  onClose: () => void;
}) {
  const t = useT(membershipDict);
  const [now] = useState(() => new Date());
  const [asking, setAsking] = useState<"activate" | "markPaid" | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const sold = soldAs(membership);
  const status = effectiveStatus(membership, now);
  const left = daysLeft(membership, now);
  const busy = actions.activate.isPending || actions.markPaid.isPending || actions.cancel.isPending;

  const close = () => {
    setAsking(null);
    onClose();
  };

  if (asking) {
    return (
      <MembershipPaymentSheet
        shopId={shopId}
        title={asking === "activate" ? t("activateTitle") : t("methodTitle")}
        amount={membership.price}
        customerName={membership.customer_name}
        busy={busy}
        onClose={() => setAsking(null)}
        onSettle={(payment) => {
          if (asking === "activate") {
            actions.activate.mutate(
              { membershipId: membership.id, payment },
              { onSuccess: close },
            );
            return;
          }
          // "Mark as paid" has no unpaid branch — the owner opened it to say
          // money arrived, so a "no" there would mean nothing.
          if ("method" in payment) {
            actions.markPaid.mutate(
              { membershipId: membership.id, method: payment.method },
              { onSuccess: close },
            );
          }
        }}
      />
    );
  }

  return (
    <>
      <BottomSheet open onClose={onClose} title={t("memberSheetTitle")}>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <AvatarChip
              label={membership.customer_name}
              avatarUrl={membership.customer_avatar_url}
              shape="circle"
              size={44}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-base font-bold text-ink">
                {membership.customer_name || t("noName")}
              </p>
              {membership.customer_phone && (
                <p className="truncate font-number text-[12px] text-muted">
                  {membership.customer_phone}
                </p>
              )}
            </div>
            <StatusPill
              tone={status === "ACTIVE" ? "good" : status === "PENDING" ? "brass" : "neutral"}
              dot={status === "ACTIVE"}
              label={t(`status${status}` as "statusACTIVE")}
            />
          </div>

          <dl className="space-y-2.5 rounded-2xl border border-line bg-soft p-3.5">
            <Row
              icon={<Crown className="h-4 w-4" />}
              label={t("colTier")}
              value={sold.name || "—"}
            />
            <Row
              icon={<Coins className="h-4 w-4" />}
              label={t("colPaid")}
              value={`৳${formatMoney(membership.price)} · ${
                membership.payment_status === "PAID" ? t("paidTag") : t("unpaidTag")
              }`}
            />
            <Row
              icon={<CalendarClock className="h-4 w-4" />}
              label={t("colExpires")}
              value={
                membership.expires_at
                  ? `${formatBanglaDate(new Date(membership.expires_at))}${
                      status === "ACTIVE" && left !== null
                        ? ` · ${t("daysLeft", toBanglaDigits(left))}`
                        : ""
                    }`
                  : "—"
              }
            />
            {membership.note && (
              <Row
                icon={<UserRound className="h-4 w-4" />}
                label={t("enrollNote")}
                value={membership.note}
              />
            )}
          </dl>

          {sold.benefits.length > 0 && (
            <ul className="space-y-1 rounded-2xl border border-line bg-card p-3.5">
              {sold.benefits.map((benefit, index) => (
                <li key={index} className="text-[13px] leading-snug text-ink">
                  · {benefit.label}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            {status === "PENDING" && (
              <Button onClick={() => setAsking("activate")} loading={busy}>
                {t("activateCta")}
              </Button>
            )}
            {status === "ACTIVE" && membership.payment_status === "DUE" && (
              <Button variant="soft" onClick={() => setAsking("markPaid")} disabled={busy}>
                {t("markPaidCta")}
              </Button>
            )}
            {!isTerminal(membership.status) && (
              <Button variant="danger" onClick={() => setCancelling(true)} disabled={busy}>
                {t("cancelMembershipCta")}
              </Button>
            )}
          </div>
        </div>
      </BottomSheet>

      {cancelling && (
        <ConfirmSheet
          open
          title={t("cancelMembershipTitle")}
          description={t("cancelMembershipBody")}
          confirmLabel={t("cancelMembershipCta")}
          cancelLabel={t("cancel")}
          loading={actions.cancel.isPending}
          onCancel={() => setCancelling(false)}
          onConfirm={() =>
            actions.cancel.mutate(
              { membershipId: membership.id },
              {
                onSuccess: () => {
                  setCancelling(false);
                  onClose();
                },
              },
            )
          }
        />
      )}
    </>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-medium text-muted">{label}</dt>
        <dd className="text-sm font-semibold break-words text-ink">{value}</dd>
      </div>
    </div>
  );
}
