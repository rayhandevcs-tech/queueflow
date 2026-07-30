"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useLanguage, useT } from "@/lib/i18n";
import {
  offerSchema,
  type OfferFormValues,
  type OfferFormOutput,
} from "../schemas/offer.schema";
import { providerOffersDict } from "../lib/i18n";

export function OfferForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (values: OfferFormOutput) => void;
  onCancel: () => void;
}) {
  const { language } = useLanguage();
  const t = useT(providerOffersDict);

  const schema = useMemo(() => offerSchema(language), [language]);
  const form = useForm<OfferFormValues, unknown, OfferFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", description: "", discount_pct: 10, valid_until: "" },
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
          {busy ? t("offerSaving") : t("createOffer")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
