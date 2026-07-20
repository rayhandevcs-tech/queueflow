"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, Mail } from "lucide-react";
import { ROLE_HOME } from "@/config/constants";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useLogin } from "../hooks/use-login";
import { loginSchema, type LoginFormValues } from "../schemas/login.schema";
import { translateAuthError } from "../lib/auth-errors";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const login = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

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
      <Field label="Email" error={err.email?.message}>
        <Input
          {...form.register("email")}
          type="email"
          icon={<Mail className="h-4 w-4" />}
          placeholder="you@example.com"
          invalid={!!err.email}
        />
      </Field>

      <Field label="Password" error={err.password?.message}>
        <Input
          {...form.register("password")}
          type="password"
          icon={<Lock className="h-4 w-4" />}
          placeholder="••••••••"
          invalid={!!err.password}
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        loading={login.isPending}
        className="w-full"
      >
        {login.isPending ? "Logging in…" : "Log in"}
      </Button>

      {login.isError && (
        <p className="text-center text-sm text-live">
          {translateAuthError(login.error)}
        </p>
      )}

      <p className="text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}
