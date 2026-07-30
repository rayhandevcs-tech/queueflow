"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { translateAuthError } from "@/lib/auth-errors";
import { useT, useLanguage } from "@/lib/i18n";
import { useChangePassword } from "../hooks/use-change-password";
import {
  changePasswordSchema,
  type ChangePasswordFormValues,
} from "../schemas/change-password.schema";
import { accountDict } from "../lib/i18n";

export function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const change = useChangePassword();
  const { language } = useLanguage();
  const t = useT(accountDict);

  const schema = useMemo(() => changePasswordSchema(language), [language]);
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(schema),
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
        {t("changePassword")}
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label={t("currentPasswordLabel")} error={err.currentPassword?.message}>
        <PasswordInput
          {...form.register("currentPassword")}
          invalid={!!err.currentPassword}
        />
      </Field>

      <Field label={t("newPasswordLabel")} error={err.newPassword?.message}>
        <PasswordInput
          {...form.register("newPassword")}
          invalid={!!err.newPassword}
        />
      </Field>

      <Field label={t("confirmLabel")} error={err.confirmPassword?.message}>
        <PasswordInput
          {...form.register("confirmPassword")}
          invalid={!!err.confirmPassword}
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={change.isPending}>
          {change.isPending ? t("changingPassword") : t("changePasswordCta")}
        </Button>
        <button
          type="button"
          onClick={() => {
            form.reset();
            setOpen(false);
          }}
          className="text-sm font-medium text-muted hover:text-ink"
        >
          {t("cancel")}
        </button>

        {change.isError && (
          <p className="text-sm text-live">{translateAuthError(change.error)}</p>
        )}
        {change.isSuccess && !change.isPending && (
          <p className="flex items-center gap-1 text-sm font-medium text-good">
            <CircleCheck className="h-4 w-4" />
            {t("passwordChanged")}
          </p>
        )}
      </div>
    </form>
  );
}
