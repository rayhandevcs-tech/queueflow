"use client";

import { useMyProfile } from "@/features/account/hooks/use-my-profile";
import { ProfileView } from "@/features/customer-profile/components/ProfileView";
import { MyLoyaltyCards } from "@/features/loyalty/components/MyLoyaltyCards";
import { MyMembershipsCard } from "@/features/membership/components/MyMembershipsCard";
import { Spinner } from "@/components/ui/Spinner";

/**
 * The customer's profile.
 *
 * The memberships and loyalty sections are composed in here rather than
 * imported by `customer-profile`, because features may not import each other.
 * Both cards render nothing at all for a customer who holds neither, so this
 * page is unchanged for everyone who has never joined a programme.
 */
export default function ProfilePage() {
  const { data: profile, isPending } = useMyProfile();

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  return (
    <ProfileView
      fullName={profile?.full_name ?? ""}
      phone={profile?.phone ?? null}
      avatarUrl={profile?.avatar_url ?? null}
      membershipSlot={<MyMembershipsCard />}
      loyaltySlot={<MyLoyaltyCards />}
    />
  );
}
