import { ForgotPasswordForm } from "@/features/auth/components/ForgotPasswordForm";
import { AuthShell } from "@/features/auth/components/AuthShell";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="পাসওয়ার্ড ভুলে গেছো?"
      subtitle="তোমার ইমেইলে একটা রিসেট লিংক পাঠাবো"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
