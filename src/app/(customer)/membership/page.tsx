"use client";

import { MyMembershipsCard } from "@/features/membership/components/MyMembershipsCard";
import { useT } from "@/lib/i18n";
import { membershipDict } from "@/features/membership/lib/i18n";

/**
 * The customer's memberships, as a destination.
 *
 * Sprint 11 gave this its own route because it needed a place in the
 * navigation: before, a customer's memberships were a card partway down
 * `/profile`, which is fine as a summary and useless as an answer to "where do
 * I check what I've paid for". The card itself is unchanged and still appears
 * on `/profile` — one component, two contexts, no second copy of the list.
 *
 * Joining still happens on a shop's own page, which is the only place that
 * knows what its tiers cost. The empty state says so.
 */
export default function MembershipPage() {
  const t = useT(membershipDict);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-xl font-bold text-ink">{t("myPageTitle")}</h1>
      <p className="mt-1 mb-4 text-[13px] leading-snug text-muted">{t("myPageSubtitle")}</p>
      <MyMembershipsCard showEmptyState hideHeading />
    </div>
  );
}
