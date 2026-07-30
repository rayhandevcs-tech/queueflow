"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail, MailCheck, Scissors, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLES } from "@/config/constants";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useT, useLanguage } from "@/lib/i18n";
import { useRegister } from "../hooks/use-register";
import {
  registerSchema,
  type RegisterFormValues,
} from "../schemas/register.schema";
import { translateAuthError } from "@/lib/auth-errors";
import { authDict } from "../lib/i18n";

export function RegisterForm() {
  const router = useRouter();
  const register = useRegister();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const { language } = useLanguage();
  const t = useT(authDict);

  const ROLE_OPTIONS = [
    { value: ROLES.CUSTOMER, label: t("customerOption"), icon: Sparkles },
    { value: ROLES.PROVIDER, label: t("providerOption"), icon: Scissors },
  ] as const;

  const schema = useMemo(() => registerSchema(language), [language]);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: ROLES.CUSTOMER,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    register.mutate(values, {
      onSuccess: ({ needsEmailConfirmation }) => {
        if (needsEmailConfirmation) {
          setSubmittedEmail(values.email);
          return;
        }
        router.replace("/complete-profile");
        router.refresh();
      },
    });
  });

  const err = form.formState.errors;
  const selectedRole = form.watch("role");

  if (submittedEmail) {
    return (
      <div className="w-full space-y-5 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-good-soft text-good">
          <MailCheck className="h-7 w-7" />
        </div>
        <p className="text-sm text-ink">{t("confirmEmailSent", submittedEmail)}</p>
        <Link href="/login" className="inline-block">
          <Button size="lg">{t("goToLogin")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-5">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-ink">{t("accountTypeLabel")}</label>
        <div className="grid grid-cols-2 gap-2">
          {ROLE_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = selectedRole === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  form.setValue("role", opt.value, { shouldDirty: true })
                }
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                  selected
                    ? "border-accent bg-accent text-accent-ink shadow-sm"
                    : "border-line bg-card text-muted hover:border-accent/40 hover:bg-soft",
                )}
              >
                <Icon className="h-5 w-5" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <Field label={t("fullNameLabel")} error={err.fullName?.message}>
        <Input
          {...form.register("fullName")}
          icon={<User className="h-4 w-4" />}
          placeholder={t("fullNamePlaceholder")}
          invalid={!!err.fullName}
        />
      </Field>

      <Field label={t("emailLabel")} error={err.email?.message}>
        <Input
          {...form.register("email")}
          type="email"
          icon={<Mail className="h-4 w-4" />}
          placeholder="you@example.com"
          invalid={!!err.email}
        />
      </Field>

      <Field label={t("passwordLabel")} error={err.password?.message}>
        <PasswordInput
          {...form.register("password")}
          icon={<Lock className="h-4 w-4" />}
          placeholder="••••••••"
          invalid={!!err.password}
        />
      </Field>

      <Field label={t("confirmPasswordLabel")} error={err.confirmPassword?.message}>
        <PasswordInput
          {...form.register("confirmPassword")}
          icon={<Lock className="h-4 w-4" />}
          placeholder="••••••••"
          invalid={!!err.confirmPassword}
        />
      </Field>

      <Button type="submit" size="lg" loading={register.isPending} className="w-full">
        {register.isPending ? t("signingUp") : t("signUpCta")}
      </Button>

      {register.isError && (
        <p className="text-center text-sm text-live">
          {translateAuthError(register.error)}
        </p>
      )}

      <p className="text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          {t("logIn")}
        </Link>
      </p>
    </form>
  );
}
