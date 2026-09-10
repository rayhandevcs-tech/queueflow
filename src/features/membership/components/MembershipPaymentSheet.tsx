"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Check, CreditCard, Smartphone, Wallet, X } from "lucide-react";
import { type PaymentMethodValue } from "@/config/constants";
import { keys } from "@/lib/query/keys";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { formatMoney } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { getShopAcceptedPaymentMethods } from "../api/shop-payments.api";
import { membershipDict } from "../lib/i18n";

const METHOD_ICON: Record<PaymentMethodValue, typeof Banknote> = {
  cash: Banknote,
  bkash: Smartphone,
  nagad: Smartphone,
  rocket: Wallet,
  card: CreditCard,
};

/**
 * Did the money come in? — for a membership.
 *
 * The third copy of the same question, and by now that is the point: the
 * queue asks it when a job is finished, the appointment board asks it when a
 * slot is finished, and this asks it when a package is sold. Same wording,
 * same two big buttons, same method list drawn from the shop's own accepted
 * methods. An owner learns it once.
 *
 * What differs from those two: "no" here still starts the membership. A
 * customer who is waved in on credit is a member from that moment — the
 * benefit is a promise the owner has already made — so the payment being
 * outstanding is recorded beside the membership rather than instead of it.
 */
export function MembershipPaymentSheet({
  shopId,
  title,
  amount,
  customerName,
  busy,
  onClose,
  onSettle,
}: {
  shopId: string;
  title: string;
  amount: number;
  customerName: string;
  busy: boolean;
  onClose: () => void;
  /** `due` and `method` are exclusive — the shape `completeSerial` set. */
  onSettle: (payment: { method: PaymentMethodValue } | { due: true }) => void;
}) {
  const t = useT(membershipDict);
  const [pickingMethod, setPickingMethod] = useState(false);

  const acceptedQuery = useQuery({
    queryKey: keys.shops.acceptedPaymentMethods(shopId),
    queryFn: () => getShopAcceptedPaymentMethods(shopId),
  });
  const accepted = (acceptedQuery.data ?? ["cash"]) as PaymentMethodValue[];

  const METHOD_LABEL: Record<PaymentMethodValue, string> = {
    cash: t("pay_cash"),
    bkash: t("pay_bkash"),
    nagad: t("pay_nagad"),
    rocket: t("pay_rocket"),
    card: t("pay_card"),
  };

  const onYes = () => {
    if (busy) return;
    if (accepted.length === 1) onSettle({ method: accepted[0] });
    else setPickingMethod(true);
  };

  return (
    <BottomSheet open onClose={onClose} maxWidthClassName="max-w-sm">
      <div className="text-center">
        <p className="text-xs font-semibold text-muted">
          {pickingMethod ? t("methodTitle") : title}
        </p>
        <p className="mt-0.5 font-display text-[2.5rem] leading-tight font-bold tabular-nums text-ink">
          ৳{formatMoney(amount)}
        </p>
        <p className="truncate text-xs text-muted">{customerName || t("noName")}</p>
      </div>

      {pickingMethod ? (
        <div className="flex flex-col gap-2">
          {accepted.map((method) => {
            const Icon = METHOD_ICON[method];
            return (
              <button
                key={method}
                type="button"
                disabled={busy}
                onClick={() => onSettle({ method })}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5 text-left transition-colors hover:border-accent/50 hover:bg-accent/[0.06] disabled:opacity-60"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-soft text-muted">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-display text-base font-bold text-ink">
                  {METHOD_LABEL[method]}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPickingMethod(false)}
            className="mt-0.5 py-1 text-center text-xs font-semibold text-muted transition-colors hover:text-ink"
          >
            {t("payBack")}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onYes}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 text-accent-ink shadow-sm transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <Check className="h-5 w-5" strokeWidth={2.5} />
            <span className="font-display text-base font-bold">{t("activateYes")}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSettle({ due: true })}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-card px-3 text-ink transition-colors hover:border-accent/50 hover:bg-soft active:scale-[0.98] disabled:opacity-60"
          >
            <X className="h-4 w-4 text-muted" strokeWidth={2.5} />
            <span className="font-display text-sm font-bold">{t("activateNo")}</span>
          </button>
          <p className="text-center text-[11px] leading-snug text-muted">{t("activateNoHint")}</p>
        </div>
      )}
    </BottomSheet>
  );
}
