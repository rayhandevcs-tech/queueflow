"use client";

import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import { CompleteProfileForm } from "@/features/onboarding/components/CompleteProfileForm";
import { onboardingDict } from "@/features/onboarding/lib/i18n";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import { Wordmark } from "@/components/ui/Wordmark";

export default function CompleteProfilePage() {
  const { data: profile, isPending } = useMyProfile();
  const t = useT(onboardingDict);

  if (isPending || !profile) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Wordmark size="md" className="justify-center" />
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">
            {t("pageTitle")}
          </h1>
          <p className="mt-1.5 text-sm text-muted">{t("pageSubtitle")}</p>
        </div>
        <CompleteProfileForm role={profile.role} />
      </div>
    </main>
  );
}
