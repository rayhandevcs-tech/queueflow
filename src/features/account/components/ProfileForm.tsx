"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck } from "lucide-react";
import type { Profile } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useUpdateMyProfile } from "../hooks/use-profile-mutations";
import { profileSchema, type ProfileFormValues } from "../schemas/profile.schema";

export function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateMyProfile();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile.full_name ?? "",
      phone: profile.phone ?? "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    const parsed = profileSchema.parse(values);
    update.mutate(parsed);
  });

  const err = form.formState.errors;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="পূর্ণ নাম" error={err.fullName?.message}>
        <Input {...form.register("fullName")} invalid={!!err.fullName} />
      </Field>

      <Field label="ফোন নম্বর" error={err.phone?.message}>
        <Input
          {...form.register("phone")}
          placeholder="01XXXXXXXXX"
          invalid={!!err.phone}
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={update.isPending}>
          {update.isPending ? "সংরক্ষণ হচ্ছে…" : "পরিবর্তন সংরক্ষণ করো"}
        </Button>

        {update.isError && (
          <p className="text-sm text-live">সংরক্ষণ করা যায়নি — আবার চেষ্টা করো।</p>
        )}
        {update.isSuccess && !update.isPending && (
          <p className="flex items-center gap-1 text-sm font-medium text-good">
            <CircleCheck className="h-4 w-4" />
            সংরক্ষিত হয়েছে
          </p>
        )}
      </div>
    </form>
  );
}
