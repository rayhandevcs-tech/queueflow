"use client";

import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { authDict } from "@/features/auth/lib/i18n";
import { useT } from "@/lib/i18n";
import { site } from "@/config/site";

export default function RegisterPage() {
  const t = useT(authDict);
  return (
    <AuthShell title={t("registerTitle")} subtitle={t("registerSubtitle", site.name)}>
      <RegisterForm />
    </AuthShell>
  );
}
