import { ResetPasswordForm } from "@/features/auth/components/ResetPasswordForm";
import { AuthShell } from "@/features/auth/components/AuthShell";

export default function ResetPasswordPage() {
  return (
    <AuthShell title="নতুন পাসওয়ার্ড সেট করো" subtitle="একবারই সেট করলেই হবে">
      <ResetPasswordForm />
    </AuthShell>
  );
}
