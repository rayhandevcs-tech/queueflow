"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import { ROLES } from "@/config/constants";
import { Spinner } from "@/components/ui/Spinner";
import { CustomerShell } from "@/app/(customer)/_components/CustomerShell";
import { ProviderShell } from "@/app/(provider)/_components/ProviderShell";

/** Shared chrome for pages both roles use (Help/Privacy/Terms/Notification Settings/etc). */
export function SharedPageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { data: profile, isPending } = useMyProfile();

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  const isProvider = profile?.role === ROLES.PROVIDER;
  const Shell = isProvider ? ProviderShell : CustomerShell;

  return (
    <Shell>
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex items-center gap-2">
          <Link
            href="/account"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-soft"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-xl font-bold text-ink">{title}</h1>
        </div>
        {children}
      </div>
    </Shell>
  );
}
