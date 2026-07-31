"use client";

import { useState } from "react";
import { Banknote, CreditCard, Receipt, Smartphone, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { ENABLED_PAYMENT_METHODS, type PaymentMethodValue } from "@/config/constants";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import type { Serial } from "@/types";
import type { useSerialActions } from "../hooks/use-serial-actions";
import { providerQueueDict } from "../lib/i18n";

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
    actions.complete.mutate({ serialId: serial.id, payment }, { onSuccess: onClose });
  };

  return (
    <BottomSheet open onClose={onClose} maxWidthClassName="max-w-sm">
      <h2 className="font-display text-lg font-bold text-ink">{t("paymentSheetTitle")}</h2>

      <div className="flex flex-col gap-2">
        {ENABLED_PAYMENT_METHODS.map((m) => {
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

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={!selected}
        loading={actions.complete.isPending}
        onClick={onConfirm}
      >
        {t("confirmPaymentCta")} · ৳{formatMoney(serial.total_amount)}
      </Button>
    </BottomSheet>
  );
}
