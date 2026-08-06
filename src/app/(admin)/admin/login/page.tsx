"use client";

import { AdminLoginForm } from "@/features/auth/components/AdminLoginForm";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { authDict } from "@/features/auth/lib/i18n";
import { useT } from "@/lib/i18n";
import { site } from "@/config/site";

export default function AdminLoginPage() {
  const t = useT(authDict);
  return (
    <AuthShell title={t("adminLoginTitle")} subtitle={t("adminLoginSubtitle", site.name)}>
      <AdminLoginForm />
    </AuthShell>
  );
}
