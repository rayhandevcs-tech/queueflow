"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Offer } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useLanguage, useT } from "@/lib/i18n";
import {
  offerSchema,
  type OfferFormValues,
  type OfferFormOutput,
} from "../schemas/offer.schema";
import { providerOffersDict } from "../lib/i18n";

/** ISO timestamp → the local yyyy-mm-dd a native date input expects. */
function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function OfferForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial?: Offer;
  busy: boolean;
  onSubmit: (values: OfferFormOutput) => void;
  onCancel: () => void;
}) {
  const { language } = useLanguage();
  const t = useT(providerOffersDict);

  const schema = useMemo(() => offerSchema(language), [language]);
  const form = useForm<OfferFormValues, unknown, OfferFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      discount_pct: initial?.discount_pct ?? 10,
      valid_until: initial ? toDateInputValue(initial.valid_until) : "",
    },
  });

  const err = form.formState.errors;

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      className="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-soft p-4 shadow-xs sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <Field error={err.title?.message}>
          <Input
            {...form.register("title")}
            placeholder={t("offerNamePlaceholder")}
            invalid={!!err.title}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field error={err.description?.message}>
          <Input
            {...form.register("description")}
            placeholder={t("descriptionOptionalPlaceholder")}
            invalid={!!err.description}
          />
        </Field>
      </div>
      <Field error={err.discount_pct?.message}>
        <Input
          {...form.register("discount_pct")}
          type="number"
          inputMode="numeric"
          placeholder={t("discountPctPlaceholder")}
          invalid={!!err.discount_pct}
        />
      </Field>
      <Field error={err.valid_until?.message}>
        <Input
          {...form.register("valid_until")}
          type="date"
          invalid={!!err.valid_until}
        />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={busy}>
          {busy ? t("offerSaving") : initial ? t("offerUpdate") : t("createOffer")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
