"use client";

import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { authDict } from "@/features/auth/lib/i18n";
import { useT } from "@/lib/i18n";
import { site } from "@/config/site";

export default function LoginPage() {
  const t = useT(authDict);
  return (
    <AuthShell title={t("loginTitle")} subtitle={t("loginSubtitle", site.name)}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
