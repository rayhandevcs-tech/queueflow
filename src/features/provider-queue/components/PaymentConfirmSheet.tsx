"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Check, CreditCard, Smartphone, Wallet, X } from "lucide-react";
import { type PaymentMethodValue } from "@/config/constants";
import { keys } from "@/lib/query/keys";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { formatMoney } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import type { Serial } from "@/types";
import { getPartyDues, getShopAcceptedPaymentMethods } from "../api/queue.api";
import type { useSerialActions } from "../hooks/use-serial-actions";
import { providerQueueDict } from "../lib/i18n";
import { partyOutstanding } from "../lib/party";

const METHOD_ICON: Record<PaymentMethodValue, typeof Banknote> = {
  cash: Banknote,
  bkash: Smartphone,
  nagad: Smartphone,
  rocket: Wallet,
  card: CreditCard,
};

/**
 * One question, not a menu: did the money come in?
 *
 * The old sheet listed every accepted method plus "due" as equal choices, then
 * asked for a second tap to confirm. In practice nearly every job is paid on
 * the spot, so the owner was picking the same answer out of a list dozens of
 * times a day. Asking yes/no makes the common case a single tap and keeps the
 * rare one — a customer leaving without paying — right there in the same
 * breath instead of in a ledger to be remembered later.
 *
 * A shop that accepts more than one method still has a real choice to make, so
 * "yes" opens the method list for it. A cash-only shop never sees that step.
 */
export function PaymentConfirmSheet({
  serial,
  onClose,
  actions,
}: {
  serial: Serial;
  onClose: () => void;
  actions: ReturnType<typeof useSerialActions>;
}) {
  const t = useT(providerQueueDict);
  const [pickingMethod, setPickingMethod] = useState(false);
  const [settleParty, setSettleParty] = useState(true);

  // A family is billed as separate jobs because that's what they are —
  // different chairs, different services, finishing at different times. But
  // one person pays at the counter, so whatever the rest of the party still
  // owes should be clearable in the same breath instead of being chased
  // through the due ledger afterwards.
  const partyQuery = useQuery({
    queryKey: keys.serials.party(serial.group_id ?? ""),
    queryFn: () => getPartyDues(serial.group_id!),
    enabled: !!serial.group_id,
  });

  const outstanding = partyOutstanding(serial.id, partyQuery.data ?? []);

  const acceptedQuery = useQuery({
    queryKey: keys.shops.acceptedPaymentMethods(serial.shop_id),
    queryFn: () => getShopAcceptedPaymentMethods(serial.shop_id),
  });
  const accepted = (acceptedQuery.data ?? ["cash"]) as PaymentMethodValue[];

  const METHOD_LABEL: Record<PaymentMethodValue, string> = {
    cash: t("cashOption"),
    bkash: t("bkashOption"),
    nagad: t("nagadOption"),
    rocket: t("rocketOption"),
    card: t("cardOption"),
  };

  const busy = actions.complete.isPending || actions.settleParty.isPending;
  const canSettleParty = outstanding.count > 0;

  const settle = (payment: { method: PaymentMethodValue } | { due: number }) => {
    if (busy) return;
    actions.complete.mutate(
      { serialId: serial.id, payment },
      {
        onSuccess: () => {
          if ("method" in payment && canSettleParty && settleParty && serial.group_id) {
            actions.settleParty.mutate({ groupId: serial.group_id, method: payment.method });
          }
          onClose();
        },
      },
    );
  };

  const onYes = () => {
    // Nothing to choose between when the shop takes one method.
    if (accepted.length === 1) settle({ method: accepted[0] });
    else setPickingMethod(true);
  };

  return (
    <BottomSheet open onClose={onClose} maxWidthClassName="max-w-sm">
      <div className="text-center">
        <p className="text-xs font-semibold text-muted">
          {pickingMethod ? t("choosePaymentMethod") : t("paymentAskTitle")}
        </p>
        {/* This job's own bill. A party's extra dues are stated on the
            checkbox below, so "no" — which only ever sends this job to the
            ledger — can never disagree with the number on screen. */}
        <p className="mt-0.5 font-display text-[2.5rem] leading-tight font-bold text-ink">
          ৳{formatMoney(serial.total_amount)}
        </p>
        {serial.customer_name && (
          <p className="truncate text-xs text-muted">{serial.customer_name}</p>
        )}
      </div>

      {canSettleParty && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-accent/30 bg-accent/[0.07] p-3.5">
          <input
            type="checkbox"
            checked={settleParty}
            onChange={(e) => setSettleParty(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-ink">
              {t("settlePartyLabel", outstanding.count)}
            </span>
            <span className="block text-[11px] text-muted">
              {t("settlePartyHint", outstanding.amount)}
            </span>
          </span>
        </label>
      )}

      {pickingMethod ? (
        <div className="flex flex-col gap-2">
          {accepted.map((m) => {
            const Icon = METHOD_ICON[m];
            return (
              <button
                key={m}
                type="button"
                disabled={busy}
                onClick={() => settle({ method: m })}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5 text-left transition-colors hover:border-accent/50 hover:bg-accent/[0.06] disabled:opacity-60"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-soft text-muted">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-display text-base font-bold text-ink">
                  {METHOD_LABEL[m]}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPickingMethod(false)}
            className="mt-0.5 py-1 text-center text-xs font-semibold text-muted transition-colors hover:text-ink"
          >
            {t("paymentBackCta")}
          </button>
        </div>
      ) : (
        // Just the answer to the question above. The word "বাকি" is
        // deliberately absent: naming the unpaid case on every single job
        // makes an owner who is paid in cash all day read a warning that
        // isn't there. "No" quietly does the ledger work.
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onYes}
            className="flex flex-col items-center gap-2 rounded-2xl bg-accent px-3 py-5 text-accent-ink shadow-sm transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <Check className="h-7 w-7" strokeWidth={2.5} />
            <span className="font-display text-lg font-bold">{t("paidYesCta")}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => settle({ due: serial.total_amount })}
            className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-card px-3 py-5 text-ink transition-colors hover:border-accent/50 hover:bg-soft active:scale-[0.98] disabled:opacity-60"
          >
            <X className="h-7 w-7 text-muted" strokeWidth={2.5} />
            <span className="font-display text-lg font-bold">{t("paidNoCta")}</span>
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
