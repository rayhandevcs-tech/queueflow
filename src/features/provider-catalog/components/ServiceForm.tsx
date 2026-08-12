"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Service } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useLanguage, useT } from "@/lib/i18n";
import {
  serviceSchema,
  type ServiceFormValues,
  type ServiceFormOutput,
} from "../schemas/service.schema";
import { providerCatalogDict } from "../lib/i18n";
import { ImageUploadField } from "./ImageUploadField";

interface Props {
  shopId: string;
  initial?: Service;
  busy: boolean;
  onSubmit: (values: ServiceFormOutput) => void;
  onCancel: () => void;
}

export function ServiceForm({ shopId, initial, busy, onSubmit, onCancel }: Props) {
  const { language } = useLanguage();
  const t = useT(providerCatalogDict);

  const schema = useMemo(() => serviceSchema(language), [language]);
  const form = useForm<ServiceFormValues, unknown, ServiceFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      rate: initial?.rate ?? 0,
      default_duration_min: initial?.default_duration_min ?? 30,
      category: (initial?.category as ServiceFormValues["category"]) ?? "OTHER",
      // category has no picker in the form (removed — the provider doesn't
      // need to manage it), so every service silently keeps its "OTHER"
      // default; only used elsewhere as the fallback category icon.
      // undefined (not null) unless a photo already exists — see schema
      // comment: keeps image_url out of the payload for untouched forms.
      image_url: initial?.image_url ?? undefined,
    },
  });

  const err = form.formState.errors;

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      className="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-soft p-4 shadow-xs sm:grid-cols-4"
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
          placeholder={t("ratePlaceholder")}
          invalid={!!err.rate}
        />
      </Field>
      <Field error={err.default_duration_min?.message}>
        <Input
          {...form.register("default_duration_min")}
          type="number"
          inputMode="numeric"
          placeholder={t("durationPlaceholder")}
          invalid={!!err.default_duration_min}
        />
      </Field>
      <div className="sm:col-span-4">
        <ImageUploadField
          shopId={shopId}
          kind="service"
          label={t("serviceImageLabel")}
          aspect="tile"
          currentUrl={form.watch("image_url") ?? null}
          onUploaded={(url) => form.setValue("image_url", url, { shouldDirty: true })}
        />
      </div>
      <div className="flex gap-2 sm:col-span-4">
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
