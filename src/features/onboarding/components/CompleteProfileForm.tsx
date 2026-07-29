"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getBrowserClient } from "@/lib/supabase/client";
import { ROLE_HOME } from "@/config/constants";
import type { UserRole } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { AvatarUploadField } from "./AvatarUploadField";
import { useCompleteOnboarding, useSkipOnboarding } from "../hooks/use-onboarding";
import {
  completeProfileSchema,
  type CompleteProfileFormValues,
} from "../schemas/complete-profile.schema";

const GENDER_OPTIONS = [
  { value: "male", label: "পুরুষ" },
  { value: "female", label: "মহিলা" },
  { value: "other", label: "অন্যান্য" },
] as const;

export function CompleteProfileForm({ role }: { role: UserRole }) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const complete = useCompleteOnboarding();
  const skip = useSkipOnboarding();

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const form = useForm<CompleteProfileFormValues>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: { phone: "", gender: null, avatarUrl: null },
  });

  const avatarUrl = form.watch("avatarUrl");
  const gender = form.watch("gender");
  const err = form.formState.errors;

  const goHome = () => {
    router.replace(ROLE_HOME[role]);
    router.refresh();
  };

  const onSubmit = form.handleSubmit((values) => {
    const parsed = completeProfileSchema.parse(values);
    complete.mutate(parsed, { onSuccess: goHome });
  });

  const onSkip = () => {
    skip.mutate(undefined, { onSuccess: goHome });
  };

  return (
    <form onSubmit={onSubmit} className="w-full space-y-5">
      {userId && (
        <AvatarUploadField
          userId={userId}
          currentUrl={avatarUrl ?? null}
          onUploaded={(url) => form.setValue("avatarUrl", url, { shouldDirty: true })}
        />
      )}

      <Field label="ফোন নম্বর" error={err.phone?.message}>
        <Input
          {...form.register("phone")}
          placeholder="01XXXXXXXXX"
          invalid={!!err.phone}
        />
      </Field>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-ink">জেন্ডার</label>
        <div className="grid grid-cols-3 gap-2">
          {GENDER_OPTIONS.map((opt) => {
            const selected = gender === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  form.setValue("gender", selected ? null : opt.value, {
                    shouldDirty: true,
                  })
                }
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                  selected
                    ? "border-accent bg-accent text-accent-ink shadow-sm"
                    : "border-line bg-card text-muted hover:border-accent/40 hover:bg-soft",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" loading={complete.isPending} className="flex-1">
          {complete.isPending ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করো"}
        </Button>
      </div>

      <button
        type="button"
        onClick={onSkip}
        disabled={skip.isPending}
        className="w-full text-center text-sm font-medium text-muted hover:text-ink"
      >
        {skip.isPending ? "এগিয়ে যাওয়া হচ্ছে…" : "এখন না, স্কিপ করো"}
      </button>

      {(complete.isError || skip.isError) && (
        <p className="text-center text-sm text-live">
          সংরক্ষণ করা যায়নি — আবার চেষ্টা করো।
        </p>
      )}
    </form>
  );
}
