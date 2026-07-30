"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BUSINESS_TYPES, type SelectableBusinessType } from "@/config/constants";
import { cn } from "@/lib/utils";
import type { Shop } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useLanguage, useT } from "@/lib/i18n";
import { useShopMutations } from "../hooks/use-my-shop";
import { shopSchema, type ShopFormValues, type ShopFormOutput } from "../schemas/shop.schema";
import { providerCatalogDict } from "../lib/i18n";
import { AboutHoursForm } from "./AboutHoursForm";
import { GalleryManager } from "./GalleryManager";
import { ImageUploadField } from "./ImageUploadField";
import { LocationPickerField } from "./LocationPickerField";

export function ShopSettingsForm({ shop }: { shop: Shop | null }) {
  const { create, update } = useShopMutations();
  const isEdit = shop !== null;
  const busy = create.isPending || update.isPending;
  const { language } = useLanguage();
  const t = useT(providerCatalogDict);
  const businessTypeT = useT(
    Object.fromEntries(BUSINESS_TYPES.map((bt) => [bt.value, bt.label])) as Record<
      SelectableBusinessType,
      { bn: string; en: string }
    >,
  );

  const schema = useMemo(() => shopSchema(language), [language]);
  const form = useForm<ShopFormValues, unknown, ShopFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: shop?.name ?? "",
      address: shop?.address ?? "",
      phone: shop?.phone ?? "",
      // Defensive normalization: legacy/unknown DB values resolve to SALON.
      business_type: shop?.business_type === "PARLOUR" ? "PARLOUR" : "SALON",
      latitude: shop?.latitude ?? null,
      longitude: shop?.longitude ?? null,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (isEdit) {
      update.mutate({ shopId: shop.id, patch: values });
    } else {
      create.mutate(values);
    }
  });

  const err = form.formState.errors;

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-5">
      {/* is_open quick toggle (edit mode only) */}
      {isEdit && (
        <div className="flex items-center justify-between rounded-2xl border border-line bg-card p-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-ink">{t("shopOpenHeading")}</p>
            <p className="text-xs text-muted">{t("shopOpenHint")}</p>
          </div>
          <button
            type="button"
            onClick={() =>
              update.mutate({
                shopId: shop.id,
                patch: { is_open: !shop.is_open },
              })
            }
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition",
              shop.is_open ? "bg-good-soft text-good" : "bg-soft text-muted",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                shop.is_open ? "bg-good animate-pulse" : "bg-muted",
              )}
            />
            {shop.is_open ? t("shopOpenWord") : t("shopClosedWord")}
          </button>
        </div>
      )}

      <Field label={t("shopNameLabel")} error={err.name?.message}>
        <Input
          {...form.register("name")}
          placeholder={t("shopNamePlaceholder")}
          invalid={!!err.name}
        />
      </Field>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-ink">{t("businessTypeLabel")}</label>
        <div className="flex gap-2">
          {BUSINESS_TYPES.map((bt) => {
            const selected = form.watch("business_type") === bt.value;
            return (
              <button
                key={bt.value}
                type="button"
                onClick={() =>
                  form.setValue("business_type", bt.value, {
                    shouldDirty: true,
                  })
                }
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
                  selected
                    ? "border-accent bg-accent text-accent-ink shadow-sm"
                    : "border-line bg-card text-muted hover:border-accent/40",
                )}
              >
                {businessTypeT(bt.value)}
              </button>
            );
          })}
        </div>
        {err.business_type && (
          <p className="text-xs font-medium text-live">{t("businessTypeRequired")}</p>
        )}
      </div>

      <Field label={t("addressLabel")} error={err.address?.message}>
        <Input
          {...form.register("address")}
          placeholder={t("addressPlaceholder")}
          invalid={!!err.address}
        />
      </Field>

      <LocationPickerField
        lat={form.watch("latitude") ?? null}
        lng={form.watch("longitude") ?? null}
        onChange={(lat, lng) => {
          form.setValue("latitude", lat, { shouldDirty: true });
          form.setValue("longitude", lng, { shouldDirty: true });
        }}
      />

      <Field label={t("phoneLabel")} error={err.phone?.message}>
        <Input
          {...form.register("phone")}
          placeholder="01XXXXXXXXX"
          invalid={!!err.phone}
        />
      </Field>

      {/* image uploads need a shopId — shown after first save */}
      {isEdit ? (
        <div className="flex gap-6 rounded-2xl border border-line bg-card p-4 shadow-sm">
          <ImageUploadField
            shopId={shop.id}
            kind="logo"
            label={t("logoLabel")}
            currentUrl={shop.logo_url}
            onUploaded={(url) =>
              update.mutate({ shopId: shop.id, patch: { logo_url: url } })
            }
          />
          <div className="flex-1">
            <ImageUploadField
              shopId={shop.id}
              kind="cover"
              label={t("coverLabel")}
              aspect="wide"
              currentUrl={shop.cover_image_url}
              onUploaded={(url) =>
                update.mutate({
                  shopId: shop.id,
                  patch: { cover_image_url: url },
                })
              }
            />
          </div>
        </div>
      ) : (
        <p className="rounded-xl bg-soft p-3 text-xs text-muted">{t("saveBeforeUploadHint")}</p>
      )}

      {isEdit && (
        <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
          <GalleryManager shopId={shop.id} />
        </div>
      )}

      {isEdit && <AboutHoursForm shop={shop} />}

      <Button type="submit" size="lg" loading={busy}>
        {busy ? t("shopSaving") : isEdit ? t("shopUpdate") : t("shopCreate")}
      </Button>

      {(create.error ?? update.error) && <p className="text-sm text-live">{t("saveFailed")}</p>}
    </form>
  );
}
