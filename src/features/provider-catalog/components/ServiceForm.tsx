"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { BusinessType, Service } from "@/types";
import { categoriesFor, isServiceCategory, type ServiceCategory } from "@/config/constants";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useLanguage, useT } from "@/lib/i18n";
import {
  serviceSchema,
  type ServiceFormValues,
  type ServiceFormOutput,
} from "../schemas/service.schema";
import { providerCatalogDict } from "../lib/i18n";
import { CategoryPicker } from "./CategoryPicker";
import { DurationField } from "./DurationField";
import { ImageUploadField } from "./ImageUploadField";

interface Props {
  shopId: string;
  businessType: BusinessType;
  initial?: Service;
  busy: boolean;
  onSubmit: (values: ServiceFormOutput) => void;
  onCancel: () => void;
}

export function ServiceForm({
  shopId,
  businessType,
  initial,
  busy,
  onSubmit,
  onCancel,
}: Props) {
  const { language } = useLanguage();
  const t = useT(providerCatalogDict);

  // The service's own category is kept on the list even if this trade would
  // not offer it — otherwise opening an old salon service tagged BRIDAL, or
  // anything tagged before this sprint's list existed, would quietly drop it.
  const options = useMemo(
    () => categoriesFor(businessType, initial?.category),
    [businessType, initial?.category],
  );

  const schema = useMemo(() => serviceSchema(language, options), [language, options]);
  const form = useForm<ServiceFormValues, unknown, ServiceFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      rate: initial?.rate ?? 0,
      default_duration_min: initial?.default_duration_min ?? 30,
      // Existing rows are often NULL, not "OTHER": the column arrived after
      // most services did. NULL stays NULL until the owner picks something,
      // so nothing gets silently relabelled by opening the editor.
      category: isServiceCategory(initial?.category) ? initial.category : null,
      // undefined (not null) unless a photo already exists — see schema
      // comment: keeps image_url out of the payload for untouched forms.
      image_url: initial?.image_url ?? undefined,
    },
  });

  const err = form.formState.errors;
  const category = form.watch("category");
  const duration = form.watch("default_duration_min");

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-soft p-4 shadow-xs sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <Field error={err.name?.message}>
          <Input
            {...form.register("name")}
            placeholder={t("serviceNamePlaceholder")}
            invalid={!!err.name}
          />
        </Field>
      </div>

      <Field error={err.rate?.message}>
        <Input
          {...form.register("rate")}
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={t("ratePlaceholder")}
          invalid={!!err.rate}
        />
      </Field>

      <div className="sm:col-span-2">
        <Field error={err.default_duration_min?.message}>
          <DurationField
            valueMin={Number(duration) || 0}
            onChange={(minutes) =>
              form.setValue("default_duration_min", minutes, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            invalid={!!err.default_duration_min}
          />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field label={t("categoryLabel")} hint={t("categoryHint")} error={err.category?.message}>
          <CategoryPicker
            options={options}
            value={category as ServiceCategory | null}
            onChange={(next) =>
              form.setValue("category", next, { shouldDirty: true, shouldValidate: true })
            }
            ariaLabel={t("categoryLabel")}
          />
        </Field>
      </div>

      <div className="sm:col-span-2">
        <ImageUploadField
          shopId={shopId}
          kind="service"
          label={t("serviceImageLabel")}
          aspect="tile"
          currentUrl={form.watch("image_url") ?? null}
          onUploaded={(url) => form.setValue("image_url", url, { shouldDirty: true })}
        />
      </div>

      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={busy}>
          {busy ? t("serviceSaving") : initial ? t("serviceUpdate") : t("serviceAdd")}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}
