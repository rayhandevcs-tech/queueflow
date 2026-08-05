"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, CreditCard, Receipt, Smartphone, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { type PaymentMethodValue } from "@/config/constants";
import { keys } from "@/lib/query/keys";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
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
  const [selected, setSelected] = useState<PaymentMethodValue | "due" | null>(null);
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
  const canSettleParty = outstanding.count > 0 && selected !== null && selected !== "due";

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

  const onConfirm = () => {
    if (!selected) return;
    const payment = selected === "due" ? { due: serial.total_amount } : { method: selected };
    actions.complete.mutate(
      { serialId: serial.id, payment },
      {
        onSuccess: () => {
          if (canSettleParty && settleParty && serial.group_id) {
            actions.settleParty.mutate({ groupId: serial.group_id, method: selected });
          }
          onClose();
        },
      },
    );
  };

  const grandTotal = serial.total_amount + (canSettleParty && settleParty ? outstanding.amount : 0);

  return (
    <BottomSheet open onClose={onClose} maxWidthClassName="max-w-sm">
      <h2 className="font-display text-lg font-bold text-ink">{t("paymentSheetTitle")}</h2>

      <div className="flex flex-col gap-2">
        {accepted.map((m) => {
          const Icon = METHOD_ICON[m];
          const active = selected === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setSelected(m)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors",
                active ? "border-accent bg-accent/10" : "border-line bg-card",
              )}
            >
              <div
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                  active ? "bg-accent text-accent-ink" : "bg-soft text-muted",
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="font-display text-base font-bold text-ink">{METHOD_LABEL[m]}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setSelected("due")}
          className={cn(
            "flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors",
            selected === "due" ? "border-accent bg-accent/10" : "border-line bg-card",
          )}
        >
          <div
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
              selected === "due" ? "bg-accent text-accent-ink" : "bg-soft text-muted",
            )}
          >
            <Receipt className="h-5 w-5" />
          </div>
          <span className="font-display text-base font-bold text-ink">{t("dueOption")}</span>
        </button>
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

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={!selected}
        loading={actions.complete.isPending || actions.settleParty.isPending}
        onClick={onConfirm}
      >
        {t("confirmPaymentCta")} · ৳{formatMoney(grandTotal)}
      </Button>
    </BottomSheet>
  );
}
