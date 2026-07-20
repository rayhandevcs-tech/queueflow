"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import { ProfileForm } from "@/features/account/components/ProfileForm";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { ROLES } from "@/config/constants";
import type { UserRole } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/ui/Logo";
import { Spinner } from "@/components/ui/Spinner";

const ROLE_LABEL: Record<UserRole, string> = {
  [ROLES.CUSTOMER]: "Customer",
  [ROLES.PROVIDER]: "Shop Owner",
};

export default function AccountPage() {
  const { data: profile, isPending } = useMyProfile();
  const logout = useLogout();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBrowserClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (!profile) {
    return <p className="p-6 text-sm text-ink">Couldn&apos;t load your profile.</p>;
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg space-y-6 px-4 py-8">
      <Link href="/" className="inline-block">
        <Logo />
      </Link>

      <div className="flex items-center gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
          <UserRound className="h-7 w-7" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold">
            {profile.full_name || "Account"}
          </h1>
          <p className="text-sm text-muted">{email}</p>
          <Badge variant="accent" className="mt-1.5">
            {ROLE_LABEL[profile.role]}
          </Badge>
        </div>
      </div>

      <Card className="p-5">
        <ProfileForm profile={profile} />
      </Card>

      <Button
        variant="danger"
        size="lg"
        onClick={() => logout.mutate()}
        loading={logout.isPending}
        className="w-full"
      >
        <LogOut className="h-4 w-4" />
        {logout.isPending ? "Signing out…" : "Sign out"}
      </Button>
    </main>
  );
}
