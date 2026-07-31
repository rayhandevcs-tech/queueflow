"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail } from "lucide-react";
import { ROLE_HOME } from "@/config/constants";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useT, useLanguage } from "@/lib/i18n";
import { useLogin } from "../hooks/use-login";
import { loginSchema, type LoginFormValues } from "../schemas/login.schema";
import { translateAuthError } from "@/lib/auth-errors";
import { authDict } from "../lib/i18n";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const login = useLogin();
  const { language } = useLanguage();
  const t = useT(authDict);

  const schema = useMemo(() => loginSchema(language), [language]);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const resetSuccess = searchParams.get("reset") === "success";

  const onSubmit = form.handleSubmit((values) => {
    login.mutate(values, {
      onSuccess: ({ role }) => {
        router.replace(next?.startsWith("/") ? next : ROLE_HOME[role]);
        router.refresh();
      },
    });
  });

  const err = form.formState.errors;
  const loginErr = login.error as { code?: string; message?: string } | null;
  const notConfirmed =
    loginErr?.code === "email_not_confirmed" ||
    (loginErr?.message ?? "").toLowerCase().includes("email not confirmed");

  return (
    <form onSubmit={onSubmit} className="w-full space-y-5">
      {resetSuccess && (
        <p className="rounded-lg bg-good-soft px-3 py-2 text-center text-sm font-medium text-good">
          {t("resetSuccess")}
        </p>
      )}

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

      <div className="-mt-3 text-right">
        <Link
          href="/forgot-password"
          className="text-xs font-medium text-accent hover:underline"
        >
          {t("forgotPassword")}
        </Link>
      </div>

      <Button
        type="submit"
        size="lg"
        loading={login.isPending}
        className="w-full"
      >
        {login.isPending ? t("loggingIn") : t("login")}
      </Button>

      {login.isError && (
        <div className="text-center text-sm text-live">
          <p>{translateAuthError(login.error)}</p>
          {notConfirmed && (
            <Link
              href={`/verify-email?email=${encodeURIComponent(form.getValues("email"))}`}
              className="font-semibold underline"
            >
              {t("emailNotConfirmedVerifyLink")}
            </Link>
          )}
        </div>
      )}

      <p className="text-center text-sm text-muted">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-semibold text-accent hover:underline">
          {t("signUp")}
        </Link>
      </p>
    </form>
  );
}
