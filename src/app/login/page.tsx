import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { site } from "@/config/site";

export default function LoginPage() {
  return (
    <AuthShell title="Welcome back" subtitle={`Log in to ${site.name}`}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
