"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, LocateFixed } from "lucide-react";
import type { Profile, TablesUpdate } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { useCurrentLocation } from "@/hooks/use-current-location";
import { useT, useLanguage } from "@/lib/i18n";
import { useUpdateMyProfile } from "../hooks/use-profile-mutations";
import { profileSchema, type ProfileFormValues } from "../schemas/profile.schema";
import { accountDict } from "../lib/i18n";

const GENDER_VALUES = ["male", "female", "other"] as const;

export function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateMyProfile();
  const { locate, busy: locating } = useCurrentLocation();
  const { language } = useLanguage();
  const t = useT(accountDict);
  const isCustomer = profile.role === "customer";

  const schema = useMemo(() => profileSchema(language), [language]);
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: profile.full_name ?? "",
      phone: profile.phone ?? "",
      gender: (profile.gender as ProfileFormValues["gender"]) ?? null,
      dateOfBirth: profile.date_of_birth ?? "",
      address: profile.address ?? "",
      addressLat: profile.address_lat ?? null,
      addressLng: profile.address_lng ?? null,
    },
  });

  const gender = form.watch("gender");

  // date_of_birth/address/address_lat/address_lng are new columns (Sprint
  // 22) — only include them in the patch when their value actually differs
  // from what's already saved. Compared directly against `profile` instead
  // of relying on RHF's dirtyFields (which turned out not to reflect values
  // set via setValue() from inside an async handler — see
  // handleUseCurrentLocation below — so a live end-to-end test caught this
  // before it could ship as a silent "save says success but nothing
  // persists" bug).
  const onSubmit = form.handleSubmit((values) => {
    const parsed = schema.parse(values);
    const patch: TablesUpdate<"profiles"> = {
      full_name: parsed.fullName,
      phone: parsed.phone,
      gender: parsed.gender ?? null,
    };

    if ((parsed.dateOfBirth || "") !== (profile.date_of_birth ?? "")) {
      patch.date_of_birth = parsed.dateOfBirth || null;
    }

    const addressChanged =
      (parsed.address || "") !== (profile.address ?? "") ||
      (parsed.addressLat ?? null) !== (profile.address_lat ?? null) ||
      (parsed.addressLng ?? null) !== (profile.address_lng ?? null);
    if (addressChanged) {
      patch.address = parsed.address || null;
      patch.address_lat = parsed.addressLat ?? null;
      patch.address_lng = parsed.addressLng ?? null;
    }

    update.mutate(patch);
  });

  const handleUseCurrentLocation = async () => {
    const result = await locate();
    if (!result) return;
    form.setValue("addressLat", result.lat, { shouldDirty: true });
    form.setValue("addressLng", result.lng, { shouldDirty: true });
    if (result.address) form.setValue("address", result.address, { shouldDirty: true });
  };

  const err = form.formState.errors;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label={t("fullNameLabel")} error={err.fullName?.message}>
        <Input {...form.register("fullName")} invalid={!!err.fullName} />
      </Field>

      <Field label={t("phoneLabel")} error={err.phone?.message}>
        <Input
          {...form.register("phone")}
          placeholder="01XXXXXXXXX"
          invalid={!!err.phone}
        />
      </Field>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-ink">{t("genderLabel")}</label>
        <div className="grid grid-cols-3 gap-2">
          {GENDER_VALUES.map((value) => {
            const selected = gender === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  form.setValue("gender", selected ? null : value, { shouldDirty: true })
                }
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                  selected
                    ? "border-accent bg-accent text-accent-ink shadow-sm"
                    : "border-line bg-card text-muted hover:border-accent/40 hover:bg-soft",
                )}
              >
                {t(value)}
              </button>
            );
          })}
        </div>
      </div>

      <Field label={t("dateOfBirthLabel")}>
        <Input {...form.register("dateOfBirth")} type="date" />
      </Field>

      {isCustomer && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium text-ink">{t("addressLabel")}</label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleUseCurrentLocation()}
              loading={locating}
            >
              <LocateFixed className="h-3.5 w-3.5" />
              {locating ? t("locatingLabel") : t("useCurrentLocationCta")}
            </Button>
          </div>
          <Input {...form.register("address")} placeholder={t("addressPlaceholder")} />
          <p className="text-xs text-muted">{t("addressHint")}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={update.isPending}>
          {update.isPending ? t("saving") : t("saveChanges")}
        </Button>

        {update.isError && <p className="text-sm text-live">{t("saveFailed")}</p>}
        {update.isSuccess && !update.isPending && (
          <p className="flex items-center gap-1 text-sm font-medium text-good">
            <CircleCheck className="h-4 w-4" />
            {t("saved")}
          </p>
        )}
      </div>
    </form>
  );
}
