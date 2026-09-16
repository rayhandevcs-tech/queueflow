"use client";

import { MyReferralsView } from "@/features/referral/components/MyReferralsView";
import { useT } from "@/lib/i18n";
import { referralDict } from "@/features/referral/lib/i18n";

/**
 * The customer's referral codes, as a destination.
 *
 * Sprint 11's other navigation fix. A referral code is minted per shop, so
 * before this page the only way to find yours was to remember which shop it
 * was at and open that shop's page — which made "share my code" a thing you
 * could do but not a thing you could go to.
 *
 * The shop tab is unchanged and still the place a code is created; this is the
 * list of the ones that exist.
 */
export default function ReferralPage() {
  const t = useT(referralDict);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-xl font-bold text-ink">{t("myPageTitle")}</h1>
      <p className="mt-1 mb-4 text-[13px] leading-snug text-muted">{t("myPageSubtitle")}</p>
      <MyReferralsView />
    </div>
  );
}
