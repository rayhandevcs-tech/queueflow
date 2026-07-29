"use client";

import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import { CompleteProfileForm } from "@/features/onboarding/components/CompleteProfileForm";
import { Spinner } from "@/components/ui/Spinner";
import { site } from "@/config/site";

export default function CompleteProfilePage() {
  const { data: profile, isPending } = useMyProfile();

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
          <span className="font-display text-lg font-bold text-ink">{site.name}</span>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">
            প্রোফাইল সম্পূর্ণ করো
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            ছবি, ফোন, জেন্ডার — চাইলে এখন দাও, চাইলে পরে
          </p>
        </div>
        <CompleteProfileForm role={profile.role} />
      </div>
    </main>
  );
}
