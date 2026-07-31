"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VerifyEmailForm } from "@/features/auth/components/VerifyEmailForm";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { authDict } from "@/features/auth/lib/i18n";
import { useT } from "@/lib/i18n";

function VerifyEmailContent() {
  const router = useRouter();
  const email = useSearchParams().get("email");

  if (!email) {
    router.replace("/register");
    return null;
  }

  return <VerifyEmailForm email={email} />;
}

export default function VerifyEmailPage() {
  const t = useT(authDict);
  return (
    <AuthShell title={t("verifyEmailTitle")} subtitle={t("verifyEmailSubtitle")}>
      <Suspense fallback={null}>
        <VerifyEmailContent />
      </Suspense>
    </AuthShell>
  );
}
