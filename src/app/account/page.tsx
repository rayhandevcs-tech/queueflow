"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, LogOut } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import { ProfileForm } from "@/features/account/components/ProfileForm";
import { ChangePasswordForm } from "@/features/account/components/ChangePasswordForm";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { ROLES } from "@/config/constants";
import type { UserRole } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProfileHeaderCard } from "@/components/ui/ProfileHeaderCard";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { Spinner } from "@/components/ui/Spinner";
import { CustomerShell } from "@/app/(customer)/_components/CustomerShell";
import { ProviderShell } from "@/app/(provider)/_components/ProviderShell";

const ROLE_LABEL: Record<UserRole, string> = {
  [ROLES.CUSTOMER]: "কাস্টমার",
  [ROLES.PROVIDER]: "দোকানদার",
};

function AccountContent({ backHref }: { backHref: string }) {
  const { data: profile, isPending } = useMyProfile();
  const logout = useLogout();
  const [email, setEmail] = useState<string | null>(null);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (!profile) {
    return <p className="text-sm text-ink">তোমার প্রোফাইল লোড করা যায়নি।</p>;
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href={backHref}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-soft"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-xl font-bold text-ink">অ্যাকাউন্ট ও সেটিংস</h1>
      </div>

      <ProfileHeaderCard
        name={profile.full_name || "নাম নেই"}
        subtitle={email ?? "—"}
        avatarUrl={profile.avatar_url}
        right={
          <Badge variant="onAccent" className="shrink-0">
            {ROLE_LABEL[profile.role]}
          </Badge>
        }
      />

      <div className="mt-4 rounded-[18px] border border-line bg-card p-5">
        <p className="mb-4 text-[13px] font-semibold tracking-wide text-muted uppercase">
          প্রোফাইল তথ্য
        </p>
        <ProfileForm profile={profile} />
      </div>

      <div className="mt-4 rounded-[18px] border border-line bg-card p-5">
        <p className="mb-4 text-[13px] font-semibold tracking-wide text-muted uppercase">
          পাসওয়ার্ড পরিবর্তন
        </p>
        <ChangePasswordForm />
      </div>

      <Button
        variant="danger"
        size="lg"
        onClick={() => setLogoutConfirmOpen(true)}
        className="mt-4 w-full"
      >
        <LogOut className="h-4 w-4" />
        লগ-আউট
      </Button>

      <ConfirmSheet
        open={logoutConfirmOpen}
        title="লগ-আউট করবে?"
        description="আবার লগইন করতে তোমার ইমেইল ও পাসওয়ার্ড লাগবে।"
        confirmLabel="লগ-আউট করো"
        cancelLabel="থাক"
        loading={logout.isPending}
        onConfirm={() => logout.mutate()}
        onCancel={() => setLogoutConfirmOpen(false)}
      />
    </div>
  );
}

export default function AccountPage() {
  const { data: profile, isPending } = useMyProfile();

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (profile?.role === ROLES.PROVIDER) {
    return (
      <ProviderShell>
        <AccountContent backHref="/dashboard" />
      </ProviderShell>
    );
  }

  return (
    <CustomerShell>
      <AccountContent backHref="/profile" />
    </CustomerShell>
  );
}
