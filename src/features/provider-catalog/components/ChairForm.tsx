"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { CHAIR_COLORS } from "@/config/constants";
import { cn } from "@/lib/utils";
import type { Chair } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useLanguage, useT } from "@/lib/i18n";
import {
  chairSchema,
  type ChairFormValues,
  type ChairFormOutput,
} from "../schemas/chair.schema";
import { providerCatalogDict } from "../lib/i18n";

interface Props {
  initial?: Chair;
  busy: boolean;
  onSubmit: (values: ChairFormOutput) => void;
  onCancel: () => void;
}

export function ChairForm({ initial, busy, onSubmit, onCancel }: Props) {
  const { language } = useLanguage();
  const t = useT(providerCatalogDict);

  const schema = useMemo(() => chairSchema(language), [language]);
  const form = useForm<ChairFormValues, unknown, ChairFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: initial?.label ?? "",
      staff_name: initial?.staff_name ?? "",
      color: initial?.color ?? CHAIR_COLORS[0],
      commission_pct: initial?.commission_pct ?? 0,
    },
  });

  const err = form.formState.errors;
  const selectedColor = form.watch("color");

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      className="space-y-3 rounded-2xl border border-line bg-soft p-4 shadow-xs"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field error={err.label?.message}>
          <Input
            {...form.register("label")}
            placeholder={t("chairLabelPlaceholder")}
            invalid={!!err.label}
          />
        </Field>
        <Field error={err.staff_name?.message}>
          <Input
            {...form.register("staff_name")}
            placeholder={t("staffNamePlaceholder")}
            invalid={!!err.staff_name}
          />
        </Field>
      </div>

      {/* 0 means salaried, which is why it stays the default — no existing
          shop should suddenly look like it owes anyone a cut. */}
      <Field label={t("commissionLabel")} hint={t("commissionHint")} error={err.commission_pct?.message}>
        <Input
          {...form.register("commission_pct")}
          inputMode="numeric"
          placeholder="0"
          invalid={!!err.commission_pct}
        />
      </Field>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-muted">{t("laneColorLabel")}</span>
        <div className="flex gap-2">
          {CHAIR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => form.setValue("color", c, { shouldDirty: true })}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full border-2 text-accent-ink transition-all",
                selectedColor === c
                  ? "scale-110 border-ink shadow-sm"
                  : "border-transparent",
              )}
              style={{ backgroundColor: c }}
              aria-label={c}
            >
              {selectedColor === c && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" loading={busy}>
          {busy ? t("chairSaving") : initial ? t("chairUpdate") : t("chairAdd")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
