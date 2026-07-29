"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { translateAuthError } from "@/lib/auth-errors";
import { useChangePassword } from "../hooks/use-change-password";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "../schemas/change-password.schema";

export function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const change = useChangePassword();

  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    change.mutate(values, {
      onSuccess: () => {
        form.reset();
        setOpen(false);
      },
    });
  });

  const err = form.formState.errors;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-soft px-4 py-3 text-sm font-semibold text-ink hover:border-accent/40"
      >
        <KeyRound className="h-4 w-4 text-muted" />
        পাসওয়ার্ড পরিবর্তন করো
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="বর্তমান পাসওয়ার্ড" error={err.currentPassword?.message}>
        <PasswordInput
          {...form.register("currentPassword")}
          invalid={!!err.currentPassword}
        />
      </Field>

      <Field label="নতুন পাসওয়ার্ড" error={err.newPassword?.message}>
        <PasswordInput
          {...form.register("newPassword")}
          invalid={!!err.newPassword}
        />
      </Field>

      <Field label="কনফার্ম করো" error={err.confirmPassword?.message}>
        <PasswordInput
          {...form.register("confirmPassword")}
          invalid={!!err.confirmPassword}
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={change.isPending}>
          {change.isPending ? "সংরক্ষণ হচ্ছে…" : "পাসওয়ার্ড বদলাও"}
        </Button>
        <button
          type="button"
          onClick={() => {
            form.reset();
            setOpen(false);
          }}
          className="text-sm font-medium text-muted hover:text-ink"
        >
          বাতিল
        </button>

        {change.isError && (
          <p className="text-sm text-live">{translateAuthError(change.error)}</p>
        )}
        {change.isSuccess && !change.isPending && (
          <p className="flex items-center gap-1 text-sm font-medium text-good">
            <CircleCheck className="h-4 w-4" />
            বদলানো হয়েছে
          </p>
        )}
      </div>
    </form>
  );
}
