import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { site } from "@/config/site";

export default function RegisterPage() {
  return (
    <AuthShell title="Create your account" subtitle={`Join ${site.name} in a minute`}>
      <RegisterForm />
    </AuthShell>
  );
}
