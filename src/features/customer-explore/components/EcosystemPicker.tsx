"use client";

import { CircleDot, CalendarCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { CUSTOMER_PREFERENCES, type CustomerPreference } from "@/lib/customer-preference";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { customerExploreDict } from "../lib/i18n";

/**
 * "Which of the two are you here for?", asked of accounts that were never
 * asked.
 *
 * Registration has required this answer since 20260926, so every new customer
 * has one. Accounts created before that have `preferred_business_type = null`,
 * and nothing was backfilled — deliberately, because guessing somebody's
 * intent from their booking history is not the same as them telling you.
 *
 * That was harmless while the preference only reordered a list. It stopped
 * being harmless the moment the preference started deciding which ecosystem
 * the app shows: a legacy account has no ecosystem, so it falls back to the
 * mixed list, which is precisely the thing the product owner asked us to get
 * rid of. Backfilling still is not the answer. Asking is.
 *
 * So this card appears exactly once per account, as the first thing on the
 * home screen, and disappears for good the moment they answer. One tap, no
 * form, no Settings trip — and it is the same column the registration form
 * writes, so there is no second source of truth.
 *
 * Deliberately not shown to guests: there is nowhere to save it, and a
 * signed-out visitor browsing the full catalogue is the correct behaviour.
 */
export function EcosystemPicker({
  onChoose,
  isSaving,
}: {
  onChoose: (preference: CustomerPreference) => void;
  isSaving: boolean;
}) {
  const t = useT(customerExploreDict);

  const OPTIONS: Record<CustomerPreference, { label: string; hint: string; icon: typeof CircleDot }> =
    {
      SALON: { label: t("pickSalon"), hint: t("pickSalonHint"), icon: CircleDot },
      PARLOUR: { label: t("pickParlour"), hint: t("pickParlourHint"), icon: CalendarCheck },
    };

  return (
    <Card tone="accent" className="mb-4 p-4">
      <p className="font-display text-[16px] leading-tight font-bold text-ink">
        {t("pickTitle")}
      </p>
      <p className="mt-1 text-[12px] leading-snug text-muted">{t("pickBody")}</p>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        {CUSTOMER_PREFERENCES.map((preference) => {
          const option = OPTIONS[preference];
          const Icon = option.icon;
          return (
            <button
              key={preference}
              type="button"
              disabled={isSaving}
              onClick={() => onChoose(preference)}
              className={cn(
                "flex min-h-20 flex-col items-start gap-1 rounded-2xl border bg-card p-3 text-left",
                "border-line transition-colors hover:border-accent hover:bg-soft",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              <Icon className="size-4 shrink-0 text-accent" />
              <span className="text-[14px] font-bold text-ink">{option.label}</span>
              <span className="text-[11px] leading-snug text-muted">{option.hint}</span>
            </button>
          );
        })}
      </div>

      {isSaving && (
        <div className="mt-2 flex items-center gap-2 text-[12px] text-muted">
          <Spinner className="size-3.5" />
          {t("pickSaving")}
        </div>
      )}

      {/* Said out loud, because a choice that feels permanent is a choice
          people avoid making. */}
      <p className="mt-2.5 text-[11px] leading-snug text-muted">{t("pickChangeable")}</p>
    </Card>
  );
}
