import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { AuthShell } from "@/features/auth/components/AuthShell";
import { site } from "@/config/site";

export default function RegisterPage() {
  return (
    <AuthShell title="অ্যাকাউন্ট তৈরি করো" subtitle={`মিনিটেই ${site.name}-এ যোগ দাও`}>
      <RegisterForm />
    </AuthShell>
  );
}
