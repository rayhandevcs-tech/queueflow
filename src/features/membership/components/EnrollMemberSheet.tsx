"use client";

import { useState } from "react";
import type { CustomerMembership, MembershipTier } from "@/types";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { useShopCustomers } from "../hooks/use-memberships";
import { membershipDict } from "../lib/i18n";
import { hasLiveMembership, sortTiers } from "../lib/membership";
import type { useMembershipActions } from "../hooks/use-memberships";
import { MembershipPaymentSheet } from "./MembershipPaymentSheet";

/**
 * Selling a membership across the counter.
 *
 * The customer list is people this shop has actually served, not everyone with
 * an account — an owner is signing up a regular who is standing in front of
 * them, and a searchable directory of strangers would be both useless and a
 * privacy hole.
 *
 * The "already a member" note is a courtesy, not a gate: the partial unique
 * index is what actually refuses a second live membership, so a stale list
 * cannot let one through.
 */
export function EnrollMemberSheet({
  shopId,
  tiers,
  memberships,
  actions,
  onClose,
  onDone,
}: {
  shopId: string;
  tiers: MembershipTier[] | undefined;
  memberships: CustomerMembership[] | undefined;
  actions: ReturnType<typeof useMembershipActions>;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useT(membershipDict);
  const [now] = useState(() => new Date());
  const { data: customers, isPending } = useShopCustomers(shopId);
  const [customerId, setCustomerId] = useState("");
  const [tierId, setTierId] = useState("");
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);

  const active = sortTiers((tiers ?? []).filter((tier) => tier.is_active));
  const chosenTier = active.find((tier) => tier.id === tierId) ?? null;
  const chosenCustomer = (customers ?? []).find((c) => c.id === customerId) ?? null;

  const alreadyMember =
    !!customerId &&
    hasLiveMembership(
      (memberships ?? []).filter((m) => m.customer_id === customerId),
      shopId,
      now,
    );

  if (asking && chosenTier) {
    return (
      <MembershipPaymentSheet
        shopId={shopId}
        title={t("activateTitle")}
        amount={chosenTier.price}
        customerName={chosenCustomer?.name ?? ""}
        busy={actions.enroll.isPending}
        onClose={() => setAsking(false)}
        onSettle={(payment) =>
          actions.enroll.mutate(
            { customerId, tierId, payment, note },
            { onSuccess: onDone },
          )
        }
      />
    );
  }

  return (
    <BottomSheet open onClose={onClose} title={t("enrollTitle")}>
      {isPending ? (
        <div className="grid min-h-24 place-items-center">
          <Spinner className="h-5 w-5 text-muted" />
        </div>
      ) : (customers?.length ?? 0) === 0 ? (
        <p className="text-[13px] leading-relaxed text-muted">{t("enrollNoCustomers")}</p>
      ) : (
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-muted">
              {t("enrollPickCustomer")}
            </span>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
            >
              <option value="">—</option>
              {customers?.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name || t("noName")}
                  {customer.phone ? ` · ${customer.phone}` : ""}
                </option>
              ))}
            </select>
          </label>

          {alreadyMember && (
            <p className="rounded-xl bg-brass-soft px-3 py-2 text-[12px] font-medium text-brass">
              {t("alreadyMember")}
            </p>
          )}

          <label className="block space-y-1">
            <span className="text-[11px] font-semibold text-muted">{t("enrollPickTier")}</span>
            <select
              value={tierId}
              onChange={(e) => setTierId(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
            >
              <option value="">—</option>
              {active.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name} · ৳{formatMoney(tier.price)} ·{" "}
                  {t("forDays", toBanglaDigits(tier.duration_days))}
                </option>
              ))}
            </select>
          </label>

          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("enrollNote")}
            maxLength={300}
          />

          {actions.enroll.isError && (
            <p className="text-sm text-live">
              {actions.enroll.error instanceof Error
                ? actions.enroll.error.message
                : t("loadFailed")}
            </p>
          )}

          <Button
            onClick={() => setAsking(true)}
            disabled={!customerId || !tierId || alreadyMember}
            loading={actions.enroll.isPending}
            className="w-full"
          >
            {t("enrollSubmit")}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
