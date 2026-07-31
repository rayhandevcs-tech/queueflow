"use client";

import { useState } from "react";
import { Banknote, Check, CreditCard, Smartphone, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { ENABLED_PAYMENT_METHODS, PAYMENT_METHOD_VALUES, type PaymentMethodValue } from "@/config/constants";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { providerPaymentMethodsDict } from "../lib/i18n";

interface Method {
  id: PaymentMethodValue;
  label: string;
  description: string;
  icon: typeof Banknote;
  enabled: boolean;
}

/**
 * UI-only preview of accepted payment rails — no gateway wired up yet
 * (see DEVELOPMENT.md's confirmed decisions). Cash is the only method that's
 * actually usable today; bKash/Nagad already work for advance payments at
 * booking time via the mock gateway (src/lib/payment/), but showing them as
 * "coming soon" here too matches the confirmed decision literally, since
 * this screen is about regular checkout, not advance payment.
 */
export function PaymentMethodsView() {
  const showToast = useToast();
  const [selected, setSelected] = useState("cash");
  const t = useT(providerPaymentMethodsDict);

  const ICON: Record<PaymentMethodValue, typeof Banknote> = {
    cash: Banknote,
    bkash: Smartphone,
    nagad: Smartphone,
    rocket: Wallet,
    card: CreditCard,
  };
  const LABEL: Record<PaymentMethodValue, string> = {
    cash: t("cashLabel"),
    bkash: t("bkashLabel"),
    nagad: t("nagadLabel"),
    rocket: t("rocketLabel"),
    card: t("cardLabel"),
  };

  const METHODS: Method[] = PAYMENT_METHOD_VALUES.map((id) => {
    const enabled = ENABLED_PAYMENT_METHODS.includes(id);
    return {
      id,
      label: LABEL[id],
      description: enabled ? t("cashDesc") : t("comingSoonDesc"),
      icon: ICON[id],
      enabled,
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">{t("pageTitle")}</h1>
        <p className="mt-1 text-[13px] text-muted">{t("pageSubtitle")}</p>
      </div>

      <div className="flex flex-col gap-2.75">
        {METHODS.map((m) => {
          const Icon = m.icon;
          const active = selected === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                if (!m.enabled) {
                  showToast(t("comingSoonToast", m.label));
                  return;
                }
                setSelected(m.id);
              }}
              className={cn(
                "flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors",
                active ? "border-accent bg-accent/10" : "border-line bg-card",
                !m.enabled && "opacity-60",
              )}
            >
              <div
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-[14px]",
                  active ? "bg-accent text-accent-ink" : "bg-soft text-muted",
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-bold text-ink">{m.label}</p>
                <p className="mt-0.5 text-xs text-muted">{m.description}</p>
              </div>
              {m.enabled ? (
                active && (
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                )
              ) : (
                <span className="shrink-0 rounded-full bg-soft px-2.5 py-1 text-[11px] font-semibold text-muted">
                  {t("comingSoonBadge")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
