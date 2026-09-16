"use client";

import { useMemo, useState } from "react";
import { useController, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Sparkles } from "lucide-react";
import type { LoyaltySettings } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { toBanglaDigits } from "@/lib/format-wait";
import { useLanguage, useT } from "@/lib/i18n";
import { usePlatformLoyaltyDefault } from "@/lib/platform-settings";
import { loyaltyDict } from "../lib/i18n";
import { DEFAULT_TAKA_PER_POINT, isLoyaltyLive, previewEarn } from "../lib/loyalty";
import {
  loyaltySettingsSchema,
  type LoyaltySettingsFormOutput,
  type LoyaltySettingsFormValues,
} from "../schemas/settings.schema";

/** Three bills an owner recognises, to make the rate concrete. */
const SAMPLE_BILLS = [500, 1000, 2500];

/**
 * The programme's rules, and the switch that makes it exist.
 *
 * The preview is the point of this card. "প্রতি ১০০ টাকায় ১ পয়েন্ট" is easy
 * to set and hard to feel, so the form works the owner's own numbers through
 * three real bills as they type — the same arithmetic the database will do,
 * from the same function the trigger mirrors.
 */
export function LoyaltySettingsCard({
  settings,
  busy,
  onSubmit,
}: {
  settings: LoyaltySettings | null | undefined;
  busy: boolean;
  onSubmit: (values: LoyaltySettingsFormOutput) => void;
}) {
  const { language } = useLanguage();
  const t = useT(loyaltyDict);
  const [editing, setEditing] = useState(false);

  // What a shop that has never configured loyalty should START from. Since
  // 20260928 that is a platform setting an admin owns, not a constant compiled
  // into the bundle — so a shop opening this form for the first time sees the
  // current policy rather than last year's. `DEFAULT_TAKA_PER_POINT` remains
  // the fallback for a failed read, and remains what the database's own fill
  // trigger falls back to, so the two can never disagree about the fallback.
  const { data: platformDefault } = usePlatformLoyaltyDefault();
  const startingRate = platformDefault ?? DEFAULT_TAKA_PER_POINT;

  const schema = useMemo(() => loyaltySettingsSchema(language), [language]);
  const form = useForm<LoyaltySettingsFormValues, unknown, LoyaltySettingsFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      is_enabled: settings?.is_enabled ?? false,
      taka_per_point: settings?.taka_per_point ?? startingRate,
      min_bill_taka: settings?.min_bill_taka ?? 0,
    },
  });

  const err = form.formState.errors;
  // `useController` rather than form.watch(): watch() re-renders the whole
  // form on every keystroke and the React Compiler refuses to memoize it.
  const { field: enabledField } = useController({ control: form.control, name: "is_enabled" });
  const { field: rateField } = useController({ control: form.control, name: "taka_per_point" });
  const { field: floorField } = useController({ control: form.control, name: "min_bill_taka" });

  const rate = Number(rateField.value) || DEFAULT_TAKA_PER_POINT;
  const floor = Number(floorField.value) || 0;
  const live = isLoyaltyLive(settings);

  const num = (n: number) => toBanglaDigits(n);

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
            // The switch saves on the spot, like the shop's open/closed
            // toggle — an owner turning a programme on should not then have
            // to find a Save button.
            onChange={(next) =>
              onSubmit({
                is_enabled: next,
                taka_per_point: settings?.taka_per_point ?? startingRate,
                min_bill_taka: settings?.min_bill_taka ?? 0,
              })
            }
          />
        </div>

        {live ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink">
            <span className="rounded-full bg-soft px-3 py-1 font-semibold">
              {t("currentRule", num(settings?.taka_per_point ?? startingRate))}
            </span>
            <span className="rounded-full bg-soft px-3 py-1 text-muted">
              {(settings?.min_bill_taka ?? 0) > 0
                ? t("currentFloor", num(settings?.min_bill_taka ?? 0))
                : t("noFloor")}
            </span>
          </div>
        ) : (
          <div className="rounded-xl bg-soft px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
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
        <Field label={t("rateLabel")} error={err.taka_per_point?.message} hint={t("rateHint")}>
          <Input
            {...form.register("taka_per_point")}
            type="number"
            inputMode="numeric"
            invalid={!!err.taka_per_point}
          />
        </Field>
        <Field label={t("minBillLabel")} error={err.min_bill_taka?.message} hint={t("minBillHint")}>
          <Input
            {...form.register("min_bill_taka")}
            type="number"
            inputMode="numeric"
            invalid={!!err.min_bill_taka}
          />
        </Field>
      </div>

      {/* The rate made concrete, recomputed as they type. */}
      <div className="rounded-xl border border-line bg-card p-3">
        <p className="text-[11px] font-semibold text-muted">{t("previewHeading")}</p>
        <ul className="mt-1.5 space-y-1">
          {SAMPLE_BILLS.map((bill) => {
            const preview = previewEarn(rate, floor, bill);
            return (
              <li key={bill} className="text-[13px] text-ink">
                {preview.belowFloor
                  ? t("previewBelowFloor", num(bill))
                  : t("previewRow", num(bill), num(preview.points))}
              </li>
            );
          })}
        </ul>
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
