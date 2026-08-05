"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaymentMethodValue } from "@/config/constants";
import type { Shop } from "@/types";
import { PaymentMethodIcon } from "@/components/ui/PaymentMethodIcon";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { useShopMutations } from "../hooks/use-my-shop";
import { providerCatalogDict } from "../lib/i18n";

/** bKash/Nagad/Rocket are manually-confirmed (no online gateway needed, same as cash) — real toggles. Card needs a POS terminal, so it stays "coming soon" everywhere. */
const TOGGLEABLE: readonly PaymentMethodValue[] = ["bkash", "nagad", "rocket"];

export function AcceptedPaymentsSection({ shop }: { shop: Shop }) {
  const { update } = useShopMutations();
  const showToast = useToast();
  const t = useT(providerCatalogDict);

  // Pre-migration rows won't have this column at all — treat that the same
  // as the column's own default (["cash"]) instead of crashing on undefined.
  const accepted = shop.accepted_payment_methods ?? ["cash"];

  const LABEL: Record<PaymentMethodValue, string> = {
    cash: t("cashLabel"),
    bkash: t("bkashLabel"),
    nagad: t("nagadLabel"),
    rocket: t("rocketLabel"),
    card: t("cardLabel"),
  };

  function toggle(method: PaymentMethodValue) {
    const next = accepted.includes(method)
      ? accepted.filter((m) => m !== method)
      : [...accepted, method];
    update.mutate(
      { shopId: shop.id, patch: { accepted_payment_methods: next } },
      { onError: () => showToast(t("paymentMethodUpdateFailed")) },
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <p className="text-sm font-semibold text-ink">{t("acceptedPaymentsTitle")}</p>
      <p className="mt-0.5 text-xs text-muted">{t("acceptedPaymentsHint")}</p>

      <div className="mt-3.5 flex flex-col gap-2">
        {/* cash: always on, not a toggle */}
        <div className="flex items-center gap-3.5 rounded-xl border border-accent bg-accent/10 p-3">
          <PaymentMethodIcon method="cash" size={40} />
          <p className="flex-1 font-display text-sm font-bold text-ink">{LABEL.cash}</p>
          <span className="shrink-0 rounded-full bg-soft px-2.5 py-1 text-[11px] font-semibold text-muted">
            {t("cashAlwaysOnHint")}
          </span>
        </div>

        {TOGGLEABLE.map((m) => {
          const on = accepted.includes(m);
          return (
            <button
              key={m}
              type="button"
              disabled={update.isPending}
              onClick={() => toggle(m)}
              className={cn(
                "flex items-center gap-3.5 rounded-xl border p-3 text-left transition-colors disabled:opacity-60",
                on ? "border-accent bg-accent/10" : "border-line bg-card",
              )}
            >
              <PaymentMethodIcon method={m} size={40} />
              <p className="flex-1 font-display text-sm font-bold text-ink">{LABEL[m]}</p>
              {on && (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-accent-ink">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          );
        })}

        {/* card: not selectable yet, no gateway/hardware to confirm it */}
        <div className="flex items-center gap-3.5 rounded-xl border border-line bg-card p-3 opacity-60">
          <PaymentMethodIcon method="card" size={40} />
          <p className="flex-1 font-display text-sm font-bold text-ink">{LABEL.card}</p>
          <span className="shrink-0 rounded-full bg-soft px-2.5 py-1 text-[11px] font-semibold text-muted">
            {t("comingSoonBadge")}
          </span>
        </div>
      </div>
    </div>
  );
}
