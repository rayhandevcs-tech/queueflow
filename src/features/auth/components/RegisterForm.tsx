"use client";

import { useState } from "react";
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
import { useRegister } from "../hooks/use-register";
import {
  registerSchema,
  type RegisterFormValues,
} from "../schemas/register.schema";
import { translateAuthError } from "@/lib/auth-errors";

const ROLE_OPTIONS = [
  { value: ROLES.CUSTOMER, label: "কাস্টমার", icon: Sparkles },
  { value: ROLES.PROVIDER, label: "দোকানদার", icon: Scissors },
] as const;

export function RegisterForm() {
  const router = useRouter();
  const register = useRegister();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
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
        <p className="text-sm text-ink">
          <span className="font-semibold">{submittedEmail}</span>-এ কনফার্মেশন
          লিংক পাঠানো হয়েছে। ইনবক্স চেক করে লিংকে ক্লিক করো, তারপর লগইন করতে
          পারবে।
        </p>
        <Link href="/login" className="inline-block">
          <Button size="lg">লগইনে যাও</Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-5">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-ink">অ্যাকাউন্টের ধরন</label>
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

      <Field label="নাম" error={err.fullName?.message}>
        <Input
          {...form.register("fullName")}
          icon={<User className="h-4 w-4" />}
          placeholder="তোমার পূর্ণ নাম"
          invalid={!!err.fullName}
        />
      </Field>

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

      <Field label="পাসওয়ার্ড কনফার্ম করো" error={err.confirmPassword?.message}>
        <PasswordInput
          {...form.register("confirmPassword")}
          icon={<Lock className="h-4 w-4" />}
          placeholder="••••••••"
          invalid={!!err.confirmPassword}
        />
      </Field>

      <Button type="submit" size="lg" loading={register.isPending} className="w-full">
        {register.isPending ? "সাইন আপ হচ্ছে…" : "সাইন আপ"}
      </Button>

      {register.isError && (
        <p className="text-center text-sm text-live">
          {translateAuthError(register.error)}
        </p>
      )}

      <p className="text-center text-sm text-muted">
        অ্যাকাউন্ট আছে?{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          লগইন করো
        </Link>
      </p>
    </form>
  );
}
