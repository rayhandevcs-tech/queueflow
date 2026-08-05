"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { SelectableBusinessType } from "@/config/constants";
import type { Shop } from "@/types";
import { getBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useLanguage, useT } from "@/lib/i18n";
import { useShopMutations } from "../hooks/use-my-shop";
import { shopSchema, type ShopFormValues, type ShopFormOutput } from "../schemas/shop.schema";
import { providerCatalogDict } from "../lib/i18n";
import { AboutHoursForm } from "./AboutHoursForm";
import { AcceptedPaymentsSection } from "./AcceptedPaymentsSection";
import { GalleryManager } from "./GalleryManager";
import { ImageUploadField } from "./ImageUploadField";
import { LocationPickerField } from "./LocationPickerField";

export function ShopSettingsForm({ shop }: { shop: Shop | null }) {
  const { create, update } = useShopMutations();
  const isEdit = shop !== null;
  const busy = create.isPending || update.isPending;
  const { language } = useLanguage();
  const t = useT(providerCatalogDict);

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

  // First shop creation only: prefill business_type from the choice made at registration
  // (shops don't exist yet at signup time, so it's carried in auth user_metadata until now).
  useEffect(() => {
    if (isEdit) return;
    const supabase = getBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      const metaType = data.user?.user_metadata?.business_type as SelectableBusinessType | undefined;
      if (metaType === "SALON" || metaType === "PARLOUR") {
        form.setValue("business_type", metaType);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

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
      <Field label={t("shopNameLabel")} error={err.name?.message}>
        <Input
          {...form.register("name")}
          placeholder={t("shopNamePlaceholder")}
          invalid={!!err.name}
        />
      </Field>

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
        onAddressDetected={(address) => form.setValue("address", address, { shouldDirty: true })}
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

      {isEdit && <AcceptedPaymentsSection shop={shop} />}

      <Button type="submit" size="lg" loading={busy}>
        {busy ? t("shopSaving") : isEdit ? t("shopUpdate") : t("shopCreate")}
      </Button>

      {(create.error ?? update.error) && <p className="text-sm text-live">{t("saveFailed")}</p>}
    </form>
  );
}
