"use client";

import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { authDict } from "@/features/auth/lib/i18n";
import { useT } from "@/lib/i18n";

export default function ForgotPasswordPage() {
  const t = useT(authDict);
  return (
    <AuthShell title={t("forgotTitle")} subtitle={t("forgotSubtitle")}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
