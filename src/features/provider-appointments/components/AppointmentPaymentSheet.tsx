"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Check, CreditCard, Smartphone, Wallet, X } from "lucide-react";
import { type PaymentMethodValue } from "@/config/constants";
import { keys } from "@/lib/query/keys";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { getShopAcceptedPaymentMethods } from "../api/appointments.api";
import { providerAppointmentsDict } from "../lib/i18n";
import type { AppointmentCard } from "../lib/types";

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
 * Deliberately the same question, in the same order, with the same two big
 * buttons as the queue's `PaymentConfirmSheet` — an owner who runs a unisex
 * shop should not have to learn two ways of closing a job. A shop that
 * accepts more than one method still has a real choice to make, so "yes"
 * opens the method list for it; a cash-only shop never sees that step.
 *
 * It is a separate component rather than that one reused because that sheet
 * carries the party logic — a family is billed as several serials settled by
 * one person at the counter — and reads `providerQueueDict`, which a sibling
 * feature may not import. An appointment is one person in one slot and never
 * has a party, so reusing it would mean genericising a working component
 * around a case that cannot occur here. The shared pieces (the sheet, the
 * method icons, the accepted-methods list) are shared; the queue-only half
 * is not copied.
 *
 * The amount is *not* editable here, unlike the queue's sheet. `total_amount`
 * on `appointments` is frozen by `appointment_before_update()` — the price
 * snapshot decision 42 made in Sprint 4 — so a booked appointment is charged
 * what it was quoted. Making it editable would mean unfreezing that column,
 * which is exactly the historical correctness this sprint is protecting.
 */
export function AppointmentPaymentSheet({
  appointment,
  shopId,
  busy,
  onClose,
  onSettle,
}: {
  appointment: AppointmentCard;
  shopId: string;
  busy: boolean;
  onClose: () => void;
  /** `due` and `method` are exclusive — exactly like `completeSerial`. */
  onSettle: (payment: { method: PaymentMethodValue } | { due: number }) => void;
}) {
  const t = useT(providerAppointmentsDict);
  const [pickingMethod, setPickingMethod] = useState(false);

  const acceptedQuery = useQuery({
    queryKey: keys.shops.acceptedPaymentMethods(shopId),
    queryFn: () => getShopAcceptedPaymentMethods(shopId),
  });
  // `["cash"]` while loading and for a row that predates the
  // accepted_payment_methods column, so the sheet never shows zero options.
  const accepted = (acceptedQuery.data ?? ["cash"]) as PaymentMethodValue[];

  const METHOD_LABEL: Record<PaymentMethodValue, string> = {
    cash: t("payCash"),
    bkash: t("payBkash"),
    nagad: t("payNagad"),
    rocket: t("payRocket"),
    card: t("payCard"),
  };

  const onYes = () => {
    if (busy) return;
    // Nothing to choose between when the shop takes one method.
    if (accepted.length === 1) onSettle({ method: accepted[0] });
    else setPickingMethod(true);
  };

  return (
    <BottomSheet open onClose={onClose} maxWidthClassName="max-w-sm">
      <div className="text-center">
        <p className="text-xs font-semibold text-muted">
          {pickingMethod ? t("payMethodTitle") : t("payAskTitle")}
        </p>
        <p className="mt-0.5 font-display text-[2.5rem] leading-tight font-bold tabular-nums text-ink">
          ৳{toBanglaDigits(appointment.totalAmount)}
        </p>
        <p className="truncate text-xs text-muted">
          {appointment.customerName || t("noCustomerName")}
        </p>
      </div>

      {pickingMethod ? (
        <div className="flex flex-col gap-2">
          {accepted.map((m) => {
            const Icon = METHOD_ICON[m];
            return (
              <button
                key={m}
                type="button"
                disabled={busy}
                onClick={() => onSettle({ method: m })}
                className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5 text-left transition-colors hover:border-accent/50 hover:bg-accent/[0.06] disabled:opacity-60"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-soft text-muted">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-display text-base font-bold text-ink">{METHOD_LABEL[m]}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setPickingMethod(false)}
            className="mt-0.5 py-1 text-center text-xs font-semibold text-muted transition-colors hover:text-ink"
          >
            {t("payBackCta")}
          </button>
        </div>
      ) : (
        // Just the answer to the question above. The word "বাকি" is
        // deliberately absent for the same reason it is absent in the queue:
        // naming the unpaid case on every single job makes an owner who is
        // paid on the spot all day read a warning that isn't there. "No"
        // quietly does the ledger work.
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onYes}
            className="flex items-center justify-center gap-2 rounded-xl bg-accent px-3 py-3 text-accent-ink shadow-sm transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            <Check className="h-5 w-5" strokeWidth={2.5} />
            <span className="font-display text-base font-bold">{t("payYesCta")}</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSettle({ due: appointment.totalAmount })}
            className="flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-3 py-3 text-ink transition-colors hover:border-accent/50 hover:bg-soft active:scale-[0.98] disabled:opacity-60"
          >
            <X className="h-5 w-5 text-muted" strokeWidth={2.5} />
            <span className="font-display text-base font-bold">{t("payNoCta")}</span>
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
