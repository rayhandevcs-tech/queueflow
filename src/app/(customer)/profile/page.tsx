"use client";

import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import { ProfileView } from "@/features/customer-profile/components/ProfileView";
import { Spinner } from "@/components/ui/Spinner";

export default function ProfilePage() {
  const { data: profile, isPending } = useMyProfile();

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  return <ProfileView fullName={profile?.full_name ?? ""} phone={profile?.phone ?? null} />;
}
