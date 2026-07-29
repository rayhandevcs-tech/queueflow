"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail } from "lucide-react";
import { ROLE_HOME } from "@/config/constants";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { useLogin } from "../hooks/use-login";
import { loginSchema, type LoginFormValues } from "../schemas/login.schema";
import { translateAuthError } from "@/lib/auth-errors";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const login = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
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

  return (
    <form onSubmit={onSubmit} className="w-full space-y-5">
      {resetSuccess && (
        <p className="rounded-lg bg-good-soft px-3 py-2 text-center text-sm font-medium text-good">
          পাসওয়ার্ড বদলানো হয়েছে — নতুন পাসওয়ার্ড দিয়ে লগইন করো।
        </p>
      )}

      <Field label="ইমেইল" error={err.email?.message}>
        <Input
          {...form.register("email")}
          type="email"
          icon={<Mail className="h-4 w-4" />}
          placeholder="you@example.com"
          invalid={!!err.email}
        />
      </Field>

      <Field label="পাসওয়ার্ড" error={err.password?.message}>
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
          পাসওয়ার্ড ভুলে গেছো?
        </Link>
      </div>

      <Button
        type="submit"
        size="lg"
        loading={login.isPending}
        className="w-full"
      >
        {login.isPending ? "লগইন হচ্ছে…" : "লগইন"}
      </Button>

      {login.isError && (
        <p className="text-center text-sm text-live">
          {translateAuthError(login.error)}
        </p>
      )}

      <p className="text-center text-sm text-muted">
        অ্যাকাউন্ট নেই?{" "}
        <Link href="/register" className="font-semibold text-accent hover:underline">
          সাইন আপ করো
        </Link>
      </p>
    </form>
  );
}
