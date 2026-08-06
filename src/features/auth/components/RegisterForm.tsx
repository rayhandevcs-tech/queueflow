"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail, Phone, Scissors, Sparkles, User } from "lucide-react";
import { ROLES } from "@/config/constants";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ChipGroup } from "@/components/ui/ChipGroup";
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
  const { language } = useLanguage();
  const t = useT(authDict);

  const ROLE_OPTIONS = [
    { value: ROLES.CUSTOMER, label: t("customerOption"), icon: Sparkles },
    { value: ROLES.PROVIDER, label: t("providerOption"), icon: Scissors },
  ] as const;

  const BUSINESS_TYPE_OPTIONS = [
    { value: "SALON" as const, label: t("salonOption") },
    { value: "PARLOUR" as const, label: t("parlourOption") },
  ];

  const schema = useMemo(() => registerSchema(language), [language]);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      role: ROLES.CUSTOMER,
      businessType: undefined,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    register.mutate(values, {
      onSuccess: ({ needsEmailConfirmation }) => {
        if (needsEmailConfirmation) {
          router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
          return;
        }
        router.replace("/complete-profile");
        router.refresh();
      },
    });
  });

  const err = form.formState.errors;
  const selectedRole = form.watch("role");
  const isProvider = selectedRole === ROLES.PROVIDER;

  return (
    <form onSubmit={onSubmit} className="w-full space-y-5">
      <Field label={t("accountTypeLabel")}>
        <ChipGroup
          options={ROLE_OPTIONS}
          value={selectedRole}
          onChange={(v) => form.setValue("role", v, { shouldDirty: true })}
          ariaLabel={t("accountTypeLabel")}
        />
      </Field>

      {/* This is not a label on the shop — it decides which dashboard the
          owner gets and what everything is called in it, so say so here
          rather than letting them discover it afterwards. */}
      {isProvider && (
        <Field
          label={t("businessTypeLabel")}
          hint={t("businessTypeHint")}
          error={err.businessType?.message}
        >
          <ChipGroup
            options={BUSINESS_TYPE_OPTIONS}
            value={form.watch("businessType")}
            onChange={(v) => form.setValue("businessType", v, { shouldDirty: true })}
            ariaLabel={t("businessTypeLabel")}
          />
        </Field>
      )}

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

      <Field label={t("phoneLabel")} error={err.phone?.message}>
        <Input
          {...form.register("phone")}
          type="tel"
          icon={<Phone className="h-4 w-4" />}
          placeholder="01XXXXXXXXX"
          invalid={!!err.phone}
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
        <p
          role="alert"
          className="rounded-[14px] border border-live/25 bg-live-soft px-3.5 py-2.5 text-center text-sm font-medium text-live"
        >
          {translateAuthError(register.error)}
        </p>
      )}

      <p className="border-t border-line pt-5 text-center text-sm text-muted">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          {t("logIn")}
        </Link>
      </p>
    </form>
  );
}
