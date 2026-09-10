"use client";

import { useMemo } from "react";
import { useController, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, X } from "lucide-react";
import { MEMBERSHIP_BENEFIT_KINDS, parseBenefits, type MembershipTier } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useLanguage, useT } from "@/lib/i18n";
import { membershipDict } from "../lib/i18n";
import { tierSchema, type TierFormOutput, type TierFormValues } from "../schemas/tier.schema";

/**
 * Create or edit one package.
 *
 * The offers form's shape and controls, with one addition: a repeating
 * benefits list. That list is a `useFieldArray` rather than a free-text box
 * because the benefits have to survive into a membership's snapshot as
 * structured data — Sprint 7's redemption engine will read them, and a
 * paragraph an owner typed cannot be read by anything.
 *
 * Editing price or duration here is safe and deliberately unguarded: every
 * membership already sold carries its own frozen snapshot, so changing a tier
 * changes what it costs *next* and nothing that has happened.
 */
export function TierForm({
  initial,
  nextSortOrder,
  busy,
  onSubmit,
  onCancel,
}: {
  initial?: MembershipTier;
  /** Where a brand-new tier lands in the ladder — after everything existing. */
  nextSortOrder: number;
  busy: boolean;
  onSubmit: (values: TierFormOutput) => void;
  onCancel: () => void;
}) {
  const { language } = useLanguage();
  const t = useT(membershipDict);

  const schema = useMemo(() => tierSchema(language), [language]);
  const form = useForm<TierFormValues, unknown, TierFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      price: initial?.price ?? 1000,
      duration_days: initial?.duration_days ?? 180,
      benefits: initial
        ? parseBenefits(initial.benefits).map((b) => ({
            kind: b.kind,
            label: b.label,
            value: b.value ?? undefined,
          }))
        : [{ kind: "DISCOUNT", label: "", value: 10 }],
      is_active: initial?.is_active ?? true,
      sort_order: initial?.sort_order ?? nextSortOrder,
    },
  });

  const benefits = useFieldArray({ control: form.control, name: "benefits" });
  const err = form.formState.errors;
  // `useController`, not `form.watch("is_active")`: watch() re-renders the
  // whole form on every keystroke anywhere in it, and the React Compiler
  // refuses to memoize a component that calls it.
  const { field: activeField } = useController({ control: form.control, name: "is_active" });
  const isActive = activeField.value;

  const KIND_LABEL = {
    DISCOUNT: t("kindDISCOUNT"),
    FREE_SERVICE: t("kindFREE_SERVICE"),
    PRIORITY_BOOKING: t("kindPRIORITY_BOOKING"),
    COMPLIMENTARY: t("kindCOMPLIMENTARY"),
    SPECIAL_OFFER: t("kindSPECIAL_OFFER"),
  } as const;

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      className="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-soft p-4 shadow-xs sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <Field error={err.name?.message}>
          <Input
            {...form.register("name")}
            placeholder={t("tierNamePlaceholder")}
            invalid={!!err.name}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field error={err.description?.message}>
          <Input
            {...form.register("description")}
            placeholder={t("tierDescPlaceholder")}
            invalid={!!err.description}
          />
        </Field>
      </div>
      <Field error={err.price?.message}>
        <Input
          {...form.register("price")}
          type="number"
          inputMode="numeric"
          placeholder={t("tierPricePlaceholder")}
          invalid={!!err.price}
        />
      </Field>
      <Field error={err.duration_days?.message}>
        <Input
          {...form.register("duration_days")}
          type="number"
          inputMode="numeric"
          placeholder={t("tierDurationPlaceholder")}
          invalid={!!err.duration_days}
        />
      </Field>

      {/* ---- benefits ---- */}
      <div className="space-y-2 sm:col-span-2">
        <div>
          <p className="text-[13px] font-semibold text-ink">{t("tierBenefitsHeading")}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted">{t("tierBenefitsHint")}</p>
        </div>

        {benefits.fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-[7rem_1fr_4.5rem_auto] gap-2">
            <select
              {...form.register(`benefits.${index}.kind`)}
              aria-label={t("tierBenefitsHeading")}
              className="h-11 w-full rounded-xl border border-line bg-card px-2 text-[13px] text-ink"
            >
              {MEMBERSHIP_BENEFIT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABEL[kind]}
                </option>
              ))}
            </select>
            <Field error={err.benefits?.[index]?.label?.message}>
              <Input
                {...form.register(`benefits.${index}.label`)}
                placeholder={t("benefitLabelPlaceholder")}
                invalid={!!err.benefits?.[index]?.label}
              />
            </Field>
            <Field error={err.benefits?.[index]?.value?.message}>
              <Input
                {...form.register(`benefits.${index}.value`)}
                type="number"
                inputMode="numeric"
                placeholder={t("benefitValuePlaceholder")}
                invalid={!!err.benefits?.[index]?.value}
              />
            </Field>
            <button
              type="button"
              onClick={() => benefits.remove(index)}
              aria-label={t("removeBenefit")}
              className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-card text-muted transition-colors hover:border-live/40 hover:text-live"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        {benefits.fields.length < 12 && (
          <button
            type="button"
            onClick={() => benefits.append({ kind: "SPECIAL_OFFER", label: "", value: undefined })}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-accent hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("addBenefit")}
          </button>
        )}
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl bg-card px-3.5 py-2.5 sm:col-span-2">
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-ink">
            {isActive ? t("tierActiveLabel") : t("tierInactiveLabel")}
          </span>
          {!isActive && (
            <span className="block text-[11px] leading-snug text-muted">
              {t("tierInactiveNote")}
            </span>
          )}
        </span>
        <Switch checked={isActive} onChange={activeField.onChange} />
      </label>

      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={busy}>
          {busy ? t("tierSaving") : initial ? t("tierUpdate") : t("tierSave")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
