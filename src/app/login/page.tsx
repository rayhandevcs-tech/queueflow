import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { site } from "@/config/site";

export default function LoginPage() {
  return (
    <AuthShell title="আবার স্বাগতম" subtitle={`${site.name}-এ লগইন করো`}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
