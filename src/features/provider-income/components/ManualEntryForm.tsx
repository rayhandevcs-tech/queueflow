"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import type { Chair, ManualEntry, Service } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useLanguage, useT } from "@/lib/i18n";
import {
  manualEntrySchema,
  type ManualEntryFormValues,
  type ManualEntryFormOutput,
} from "../schemas/manual-entry.schema";
import { providerIncomeDict } from "../lib/i18n";

interface Props {
  services: Service[];
  chairs: Chair[];
  initial?: ManualEntry;
  busy: boolean;
  onSubmit: (values: ManualEntryFormOutput) => void;
  onCancel: () => void;
}

export function ManualEntryForm({ services, chairs, initial, busy, onSubmit, onCancel }: Props) {
  const { language } = useLanguage();
  const t = useT(providerIncomeDict);

  const schema = useMemo(() => manualEntrySchema(language), [language]);
  const form = useForm<ManualEntryFormValues, unknown, ManualEntryFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      service_id: initial?.service_id ?? services[0]?.id ?? "",
      chair_id: initial?.chair_id ?? "",
      amount: initial?.amount ?? ("" as unknown as number),
      payment_status: initial?.payment_status ?? "PAID",
      payment_method: initial?.payment_method ?? "cash",
      note: initial?.note ?? "",
    },
  });

  const err = form.formState.errors;
  const paymentStatus = form.watch("payment_status");

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      className="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-soft p-4 shadow-xs sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <Field error={err.service_id?.message} label={t("manualEntryServiceLabel")}>
          <select
            {...form.register("service_id")}
            className="h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
          >
            {services.length === 0 && <option value="">{t("manualEntryNoServices")}</option>}
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {!s.is_active ? ` (${t("manualEntryInactiveSuffix")})` : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field error={err.amount?.message} label={t("manualEntryAmountLabel")}>
        <Input {...form.register("amount")} type="number" inputMode="numeric" placeholder="৳" />
      </Field>

      <Field label={t("manualEntryStaffLabel")}>
        <select
          {...form.register("chair_id")}
          className="h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
        >
          <option value="">{t("manualEntryNoStaff")}</option>
          {chairs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.staff_name || c.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="sm:col-span-2">
        <Field label={t("manualEntryPaymentLabel")}>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                form.setValue("payment_status", "PAID", { shouldDirty: true });
                form.setValue("payment_method", "cash", { shouldDirty: true });
              }}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                paymentStatus === "PAID"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line bg-card text-muted",
              )}
            >
              {t("manualEntryCashOption")}
            </button>
            <button
              type="button"
              onClick={() => {
                form.setValue("payment_status", "DUE", { shouldDirty: true });
                form.setValue("payment_method", null, { shouldDirty: true });
              }}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                paymentStatus === "DUE"
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line bg-card text-muted",
              )}
            >
              {t("manualEntryDueOption")}
            </button>
          </div>
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field error={err.note?.message} label={t("manualEntryNoteLabel")}>
          <Input {...form.register("note")} placeholder={t("manualEntryNotePlaceholder")} />
        </Field>
      </div>

      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={busy} disabled={services.length === 0}>
          {busy ? t("manualEntrySaving") : initial ? t("manualEntryUpdate") : t("manualEntryAdd")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("manualEntryCancel")}
        </Button>
      </div>
    </form>
  );
}
