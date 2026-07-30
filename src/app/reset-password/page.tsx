"use client";

import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { authDict } from "@/features/auth/lib/i18n";
import { useT } from "@/lib/i18n";

export default function ResetPasswordPage() {
  const t = useT(authDict);
  return (
    <AuthShell title={t("resetTitle")} subtitle={t("resetSubtitle")}>
      <ResetPasswordForm />
    </AuthShell>
  );
}
