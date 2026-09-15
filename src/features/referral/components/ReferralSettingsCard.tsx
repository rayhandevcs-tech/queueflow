"use client";

import { useMemo, useState } from "react";
import { useController, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Gift, Lock } from "lucide-react";
import type { LoyaltySettings } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { toBanglaDigits } from "@/lib/format-wait";
import { useLanguage, useT } from "@/lib/i18n";
import { referralDict } from "../lib/i18n";
import {
  DEFAULT_REFERRED_POINTS,
  DEFAULT_REFERRER_POINTS,
  canEnableReferral,
  isReferralLive,
  referralReward,
} from "../lib/referral";
import {
  referralSettingsSchema,
  type ReferralSettingsFormOutput,
  type ReferralSettingsFormValues,
} from "../schemas/referral-settings.schema";

/**
 * The referral rules, and the switch that makes them exist.
 *
 * Built to loyalty's settings card, deliberately: same read-only summary,
 * same switch-saves-on-the-spot behaviour, same two-column form. An owner who
 * has configured points should recognise this screen before reading it.
 *
 * The one thing it does that loyalty's does not is **refuse to show the
 * switch at all when loyalty is off**, and say why. A referral reward is a
 * loyalty point; offering the switch and then having the server decline it
 * would be a worse explanation than the notice.
 */
export function ReferralSettingsCard({
  settings,
  busy,
  onSubmit,
  loyaltyHref,
}: {
  settings: LoyaltySettings | null | undefined;
  busy: boolean;
  onSubmit: (values: ReferralSettingsFormOutput) => void;
  /** Where "switch points on first" sends the owner. */
  loyaltyHref?: string;
}) {
  const { language } = useLanguage();
  const t = useT(referralDict);
  const [editing, setEditing] = useState(false);

  const schema = useMemo(() => referralSettingsSchema(language), [language]);
  const form = useForm<ReferralSettingsFormValues, unknown, ReferralSettingsFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      referral_enabled: settings?.referral_enabled ?? false,
      referral_referrer_points: settings?.referral_referrer_points || DEFAULT_REFERRER_POINTS,
      referral_referred_points: settings?.referral_referred_points ?? DEFAULT_REFERRED_POINTS,
    },
  });

  const err = form.formState.errors;
  // `useController` rather than form.watch(): watch() re-renders the whole
  // form on every keystroke and the React Compiler refuses to memoize it.
  const { field: enabledField } = useController({
    control: form.control,
    name: "referral_enabled",
  });

  const live = isReferralLive(settings);
  const reward = referralReward(settings);
  const num = (n: number) => toBanglaDigits(n);

  // ---- loyalty is off: there is nothing to configure yet ----
  if (!canEnableReferral(settings)) {
    return (
      <div className="space-y-2 rounded-2xl border border-line bg-card p-4 shadow-xs">
        <p className="font-display text-base font-bold text-ink">{t("settingsHeading")}</p>
        <div className="rounded-xl bg-soft px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <Lock className="h-3.5 w-3.5 text-brass" />
            {t("needsLoyaltyTitle")}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-muted">{t("needsLoyaltyBody")}</p>
        </div>
        {loyaltyHref && (
          <a
            href={loyaltyHref}
            className="inline-block text-[13px] font-semibold text-accent hover:underline"
          >
            {t("goToLoyalty")}
          </a>
        )}
      </div>
    );
  }

  // ---- read-only summary, until the owner asks to edit ----
  if (!editing) {
    return (
      <div className="space-y-3 rounded-2xl border border-line bg-card p-4 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-base font-bold text-ink">{t("settingsHeading")}</p>
            <p className="mt-0.5 text-[12px] text-muted">
              {live ? t("enabledLabel") : t("disabledLabel")}
            </p>
          </div>
          <Switch
            checked={live}
            disabled={busy}
            // Saves on the spot, like loyalty's switch and the shop's
            // open/closed toggle. The points travel with it so flipping the
            // switch never silently resets what the owner had configured.
            onChange={(next) =>
              onSubmit({
                referral_enabled: next,
                referral_referrer_points:
                  settings?.referral_referrer_points || DEFAULT_REFERRER_POINTS,
                referral_referred_points:
                  settings?.referral_referred_points ?? DEFAULT_REFERRED_POINTS,
              })
            }
          />
        </div>

        {live ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink">
            <span className="rounded-full bg-soft px-3 py-1 font-semibold">
              {t("currentReward", num(reward.referrer), num(reward.referred))}
            </span>
            {reward.referred === 0 && (
              <span className="rounded-full bg-soft px-3 py-1 text-muted">
                {t("rewardNoneForNewcomer")}
              </span>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-soft px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <Gift className="h-3.5 w-3.5 text-accent" />
              {t("offNoticeTitle")}
            </p>
            <p className="mt-1 text-[12px] leading-snug text-muted">{t("offNoticeBody")}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-[13px] font-semibold text-accent hover:underline"
        >
          {t("editRules")}
        </button>
      </div>
    );
  }

  // ---- the form ----
  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        onSubmit(values);
        setEditing(false);
      })}
      className="space-y-3 rounded-2xl border border-line bg-soft p-4 shadow-xs"
    >
      <p className="font-display text-base font-bold text-ink">{t("settingsHeading")}</p>

      <label className="flex items-center justify-between gap-3 rounded-xl bg-card px-3.5 py-2.5">
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-ink">
            {enabledField.value ? t("enabledLabel") : t("disabledLabel")}
          </span>
          <span className="block text-[11px] leading-snug text-muted">{t("enabledHint")}</span>
        </span>
        <Switch checked={!!enabledField.value} onChange={enabledField.onChange} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t("referrerPointsLabel")}
          error={err.referral_referrer_points?.message}
          hint={t("referrerPointsHint")}
        >
          <Input
            {...form.register("referral_referrer_points")}
            type="number"
            inputMode="numeric"
            invalid={!!err.referral_referrer_points}
          />
        </Field>
        <Field
          label={t("referredPointsLabel")}
          error={err.referral_referred_points?.message}
          hint={t("referredPointsHint")}
        >
          <Input
            {...form.register("referral_referred_points")}
            type="number"
            inputMode="numeric"
            invalid={!!err.referral_referred_points}
          />
        </Field>
      </div>

      <div className="flex gap-2">
        <Button type="submit" loading={busy}>
          {busy ? t("settingsSaving") : t("settingsSave")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            form.reset();
            setEditing(false);
          }}
        >
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
