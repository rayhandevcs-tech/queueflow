"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail, ShieldCheck } from "lucide-react";
import { ADMIN_HOME } from "@/config/constants";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useT, useLanguage } from "@/lib/i18n";
import { useAdminLogin } from "../hooks/use-login";
import { loginSchema, type LoginFormValues } from "../schemas/login.schema";
import { translateAuthError } from "@/lib/auth-errors";
import { authDict } from "../lib/i18n";

/**
 * The panel's own door. Same validation schema as the main login — a password
 * is a password — but a different sign-in path: signInAdmin() signs anyone who
 * is not an active admin straight back out.
 *
 * There is deliberately no "sign up" and no "forgot password" here: admin
 * accounts are created by another admin, and a self-serve reset link on this
 * screen would be a way to probe which addresses are admins.
 */
export function AdminLoginForm() {
  const router = useRouter();
  const login = useAdminLogin();
  const { language } = useLanguage();
  const t = useT(authDict);

  const schema = useMemo(() => loginSchema(language), [language]);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: () => {
        router.replace(ADMIN_HOME);
        router.refresh();
      },
    });
  });

  const err = form.formState.errors;

  return (
    <form onSubmit={onSubmit} className="w-full space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-soft px-4 py-3.5">
        <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-accent" />
        <p className="text-[13px] leading-relaxed text-muted">{t("adminLoginNotice")}</p>
      </div>

      <Field label={t("emailLabel")} error={err.email?.message}>
        <Input
          {...form.register("email")}
          type="email"
          autoComplete="email"
          icon={<Mail className="h-4 w-4" />}
          placeholder="admin@example.com"
          invalid={!!err.email}
        />
      </Field>

      <Field label={t("passwordLabel")} error={err.password?.message}>
        <PasswordInput
          {...form.register("password")}
          autoComplete="current-password"
          icon={<Lock className="h-4 w-4" />}
          placeholder="••••••••"
          invalid={!!err.password}
        />
      </Field>

      <Button type="submit" size="lg" loading={login.isPending} className="w-full">
        {login.isPending ? t("loggingIn") : t("login")}
      </Button>

      {login.isError && (
        <p
          role="alert"
          className="rounded-[14px] border border-live/25 bg-live-soft px-3.5 py-2.5 text-center text-sm font-medium text-live"
        >
          {translateAuthError(login.error)}
        </p>
      )}

      <p className="border-t border-line pt-5 text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-accent hover:underline">
          {t("backToAppLogin")}
        </Link>
      </p>
    </form>
  );
}
