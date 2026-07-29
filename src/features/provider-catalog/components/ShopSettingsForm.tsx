"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BUSINESS_TYPES } from "@/config/constants";
import { cn } from "@/lib/utils";
import type { Shop } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useShopMutations } from "../hooks/use-my-shop";
import { shopSchema, type ShopFormValues, type ShopFormOutput } from "../schemas/shop.schema";
import { AboutHoursForm } from "./AboutHoursForm";
import { GalleryManager } from "./GalleryManager";
import { ImageUploadField } from "./ImageUploadField";
import { LocationPickerField } from "./LocationPickerField";

export function ShopSettingsForm({ shop }: { shop: Shop | null }) {
  const { create, update } = useShopMutations();
  const isEdit = shop !== null;
  const busy = create.isPending || update.isPending;

  const form = useForm<ShopFormValues, unknown, ShopFormOutput>({
    resolver: zodResolver(shopSchema),
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
            <p className="text-sm font-semibold text-ink">দোকান খোলা</p>
            <p className="text-xs text-muted">
              বন্ধ থাকলে নতুন কোনো সিরিয়াল বুক করা যাবে না
            </p>
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
            {shop.is_open ? "খোলা" : "বন্ধ"}
          </button>
        </div>
      )}

      <Field label="দোকানের নাম" error={err.name?.message}>
        <Input
          {...form.register("name")}
          placeholder="যেমন: নিউ স্টার সেলুন"
          invalid={!!err.name}
        />
      </Field>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-ink">ধরন</label>
        <div className="flex gap-2">
          {BUSINESS_TYPES.map((t) => {
            const selected = form.watch("business_type") === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() =>
                  form.setValue("business_type", t.value, {
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
                {t.label}
              </button>
            );
          })}
        </div>
        {err.business_type && (
          <p className="text-xs font-medium text-live">একটা ধরন বেছে নাও</p>
        )}
      </div>

      <Field label="ঠিকানা" error={err.address?.message}>
        <Input
          {...form.register("address")}
          placeholder="রোড, এলাকা, শহর"
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

      <Field label="ফোন" error={err.phone?.message}>
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
            label="লোগো"
            currentUrl={shop.logo_url}
            onUploaded={(url) =>
              update.mutate({ shopId: shop.id, patch: { logo_url: url } })
            }
          />
          <div className="flex-1">
            <ImageUploadField
              shopId={shop.id}
              kind="cover"
              label="কভার ছবি"
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
        <p className="rounded-xl bg-soft p-3 text-xs text-muted">
          দোকান সংরক্ষণ করার পর লোগো ও কভার ছবি আপলোড করতে পারবে।
        </p>
      )}

      {isEdit && (
        <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
          <GalleryManager shopId={shop.id} />
        </div>
      )}

      {isEdit && <AboutHoursForm shop={shop} />}

      <Button type="submit" size="lg" loading={busy}>
        {busy ? "সংরক্ষণ হচ্ছে…" : isEdit ? "আপডেট করো" : "দোকান তৈরি করো"}
      </Button>

      {(create.error ?? update.error) && (
        <p className="text-sm text-live">
          সংরক্ষণ করা যায়নি — আবার চেষ্টা করো।
        </p>
      )}
    </form>
  );
}
