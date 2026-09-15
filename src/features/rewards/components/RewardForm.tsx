"use client";

import { useMemo } from "react";
import { useController, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BadgePercent, Gift, Ticket } from "lucide-react";
import type { Reward, Service } from "@/types";
import { Button } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { Field, Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useLanguage, useT } from "@/lib/i18n";
import { rewardsDict } from "../lib/i18n";
import { DEFAULT_KINDS } from "../lib/form-defaults";
import { rewardSchema, type RewardFormOutput, type RewardFormValues } from "../schemas/reward.schema";

/**
 * Create or edit one reward.
 *
 * The tier form's shape and controls, with one difference: which fields are
 * shown depends on the kind. A flat reward needs taka, a percentage reward
 * needs a percentage, a free service needs a service — and showing all three
 * at once would invite the owner to fill in a combination the database
 * refuses (`rewards_value_matches_kind`).
 *
 * Switching kind keeps whatever was typed rather than clearing the form; the
 * API layer nulls the fields that do not belong to the chosen kind, so a
 * half-remembered service id can never travel with a flat discount.
 *
 * Editing points_cost or value here is safe and deliberately unguarded: every
 * coupon already issued carries its own frozen snapshot, so changing a reward
 * changes what it costs *next* and nothing that has happened.
 */
export function RewardForm({
  initial,
  services,
  nextSortOrder,
  busy,
  onSubmit,
  onCancel,
}: {
  initial?: Reward;
  /** This shop's active services — a FREE_SERVICE reward must name one. */
  services: Service[] | undefined;
  nextSortOrder: number;
  busy: boolean;
  onSubmit: (values: RewardFormOutput) => void;
  onCancel: () => void;
}) {
  const { language } = useLanguage();
  const t = useT(rewardsDict);

  const schema = useMemo(() => rewardSchema(language), [language]);
  const form = useForm<RewardFormValues, unknown, RewardFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
      kind: initial?.kind ?? "DISCOUNT_FLAT",
      points_cost: initial?.points_cost ?? 100,
      value: initial?.value ?? 100,
      service_id: initial?.service_id ?? "",
      stock: initial?.stock ?? "",
      valid_until: initial?.valid_until ? initial.valid_until.slice(0, 10) : "",
      is_active: initial?.is_active ?? true,
      sort_order: initial?.sort_order ?? nextSortOrder,
    },
  });

  const err = form.formState.errors;
  // `useController` rather than form.watch(): watch() re-renders the whole
  // form on every keystroke and the React Compiler refuses to memoize it.
  const { field: kindField } = useController({ control: form.control, name: "kind" });
  const { field: serviceField } = useController({ control: form.control, name: "service_id" });
  const { field: activeField } = useController({ control: form.control, name: "is_active" });

  const kind = kindField.value ?? "DISCOUNT_FLAT";
  const live = services?.filter((service) => service.is_active) ?? [];

  const kindOptions = DEFAULT_KINDS.map((option) => ({
    value: option,
    label: t(`kind${option}` as "kindDISCOUNT_FLAT"),
    icon: option === "FREE_SERVICE" ? Gift : option === "DISCOUNT_PCT" ? BadgePercent : Ticket,
  }));

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-3.5"
    >
      <Field label={t("nameLabel")} error={err.name?.message}>
        <Input
          {...form.register("name")}
          placeholder={t("namePlaceholder")}
          invalid={!!err.name}
        />
      </Field>

      <Field
        label={t("descriptionLabel")}
        error={err.description?.message}
        hint={t("descriptionHint")}
      >
        <Input {...form.register("description")} invalid={!!err.description} />
      </Field>

      <Field label={t("kindLabel")}>
        <ChipGroup
          options={kindOptions}
          value={kind}
          onChange={kindField.onChange}
          columns={3}
          ariaLabel={t("kindLabel")}
        />
      </Field>
      <p className="-mt-1.5 text-[11px] leading-snug text-muted">
        {kind === "FREE_SERVICE"
          ? t("kindFreeHint")
          : kind === "DISCOUNT_PCT"
            ? t("kindPctHint")
            : t("kindFlatHint")}
      </p>

      {/* What the reward is worth — one field, whichever kind needs it. */}
      {kind === "FREE_SERVICE" ? (
        <Field label={t("serviceLabel")} error={err.service_id?.message}>
          {live.length === 0 ? (
            <p className="rounded-xl bg-soft px-3.5 py-3 text-[12px] leading-snug text-muted">
              {t("noServices")}
            </p>
          ) : (
            <select
              value={typeof serviceField.value === "string" ? serviceField.value : ""}
              onChange={(event) => serviceField.onChange(event.target.value)}
              className="w-full rounded-xl border border-line bg-card px-3.5 py-3 text-sm text-ink focus:border-accent focus:ring-2 focus:ring-accent/15 focus:outline-none"
            >
              <option value="">{t("servicePlaceholder")}</option>
              {live.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      ) : (
        <Field
          label={kind === "DISCOUNT_PCT" ? t("pctValueLabel") : t("flatValueLabel")}
          error={err.value?.message}
        >
          <Input
            {...form.register("value")}
            type="number"
            inputMode="numeric"
            invalid={!!err.value}
          />
        </Field>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t("pointsCostLabel")}
          error={err.points_cost?.message}
          hint={t("pointsCostHint")}
        >
          <Input
            {...form.register("points_cost")}
            type="number"
            inputMode="numeric"
            invalid={!!err.points_cost}
          />
        </Field>
        <Field label={t("stockLabel")} error={err.stock?.message} hint={t("stockHint")}>
          <Input
            {...form.register("stock")}
            type="number"
            inputMode="numeric"
            placeholder={t("unlimited")}
            invalid={!!err.stock}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t("validUntilLabel")}
          error={err.valid_until?.message}
          hint={t("validUntilHint")}
        >
          <Input {...form.register("valid_until")} type="date" invalid={!!err.valid_until} />
        </Field>
        <Field label={t("sortOrderLabel")} error={err.sort_order?.message}>
          <Input
            {...form.register("sort_order")}
            type="number"
            inputMode="numeric"
            invalid={!!err.sort_order}
          />
        </Field>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl bg-soft px-3.5 py-2.5">
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-ink">
            {activeField.value ? t("activeLabel") : t("inactiveLabel")}
          </span>
          <span className="block text-[11px] leading-snug text-muted">{t("activeHint")}</span>
        </span>
        <Switch checked={!!activeField.value} onChange={activeField.onChange} />
      </label>

      <div className="flex gap-2 pt-1">
        <Button type="submit" loading={busy} className="flex-1">
          {busy ? t("saving") : t("save")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
