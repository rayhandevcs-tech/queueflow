"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useForgotPassword } from "../hooks/use-forgot-password";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "../schemas/forgot-password.schema";
import { translateAuthError } from "@/lib/auth-errors";

export function ForgotPasswordForm() {
  const forgotPassword = useForgotPassword();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit((values) => {
    forgotPassword.mutate(values, {
      onSuccess: () => setSubmittedEmail(values.email),
    });
  });

  const err = form.formState.errors;

  if (submittedEmail) {
    return (
      <div className="w-full space-y-5 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-good-soft text-good">
          <MailCheck className="h-7 w-7" />
        </div>
        <p className="text-sm text-ink">
          <span className="font-semibold">{submittedEmail}</span>-এ পাসওয়ার্ড
          রিসেট লিংক পাঠানো হয়েছে। ইনবক্স চেক করো।
        </p>
        <Link href="/login" className="inline-block">
          <Button size="lg">লগইনে ফিরে যাও</Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-5">
      <Field label="ইমেইল" error={err.email?.message}>
        <Input
          {...form.register("email")}
          type="email"
          icon={<Mail className="h-4 w-4" />}
          placeholder="you@example.com"
          invalid={!!err.email}
        />
      </Field>

      <Button
        type="submit"
        size="lg"
        loading={forgotPassword.isPending}
        className="w-full"
      >
        {forgotPassword.isPending ? "পাঠানো হচ্ছে…" : "রিসেট লিংক পাঠাও"}
      </Button>

      {forgotPassword.isError && (
        <p className="text-center text-sm text-live">
          {translateAuthError(forgotPassword.error)}
        </p>
      )}

      <p className="text-center text-sm text-muted">
        পাসওয়ার্ড মনে পড়েছে?{" "}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          লগইন করো
        </Link>
      </p>
    </form>
  );
}
