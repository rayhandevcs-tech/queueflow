"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { signOut } from "../api/auth.api";
import { useResetPassword } from "../hooks/use-reset-password";
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "../schemas/reset-password.schema";
import { translateAuthError } from "@/lib/auth-errors";

export function ResetPasswordForm() {
  const router = useRouter();
  const resetPassword = useResetPassword();

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
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
      <Field label="নতুন পাসওয়ার্ড" error={err.password?.message}>
        <PasswordInput
          {...form.register("password")}
          icon={<Lock className="h-4 w-4" />}
          placeholder="••••••••"
          invalid={!!err.password}
        />
      </Field>

      <Field label="কনফার্ম করো" error={err.confirmPassword?.message}>
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
        {resetPassword.isPending ? "সংরক্ষণ হচ্ছে…" : "পাসওয়ার্ড বদলাও"}
      </Button>

      {resetPassword.isError && (
        <p className="text-center text-sm text-live">
          {translateAuthError(resetPassword.error)}
        </p>
      )}
    </form>
  );
}
