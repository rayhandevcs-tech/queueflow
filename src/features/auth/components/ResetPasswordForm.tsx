"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useT, useLanguage } from "@/lib/i18n";
import { signOut } from "../api/auth.api";
import { useResetPassword } from "../hooks/use-reset-password";
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "../schemas/reset-password.schema";
import { translateAuthError } from "@/lib/auth-errors";
import { authDict } from "../lib/i18n";

export function ResetPasswordForm() {
  const router = useRouter();
  const resetPassword = useResetPassword();
  const { language } = useLanguage();
  const t = useT(authDict);

  const schema = useMemo(() => resetPasswordSchema(language), [language]);
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    resetPassword.mutate(values.password, {
      onSuccess: async () => {
        await signOut();
        router.replace("/login?reset=success");
      },
    });
  });

  const err = form.formState.errors;

  return (
    <form onSubmit={onSubmit} className="w-full space-y-5">
      <Field label={t("newPasswordLabel")} error={err.password?.message}>
        <PasswordInput
          {...form.register("password")}
          icon={<Lock className="h-4 w-4" />}
          placeholder="••••••••"
          invalid={!!err.password}
        />
      </Field>

      <Field label={t("confirmLabel")} error={err.confirmPassword?.message}>
        <PasswordInput
          {...form.register("confirmPassword")}
          icon={<Lock className="h-4 w-4" />}
          placeholder="••••••••"
          invalid={!!err.confirmPassword}
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        loading={resetPassword.isPending}
        className="w-full"
      >
        {resetPassword.isPending ? t("changingPassword") : t("changePasswordCta")}
      </Button>

      {resetPassword.isError && (
        <p className="text-center text-sm text-live">
          {translateAuthError(resetPassword.error)}
        </p>
      )}
    </form>
  );
}
