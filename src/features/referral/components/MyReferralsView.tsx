"use client";

import Link from "next/link";
import { Share2 } from "lucide-react";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import { useMyReferralShops } from "../hooks/use-referral";
import { referralDict } from "../lib/i18n";
import { MyReferralCard } from "./MyReferralCard";

/**
 * Every referral code this customer holds, across every shop.
 *
 * The card below each shop's name is `MyReferralCard` — the same component the
 * shop page has used since Sprint 8, with the same code, the same WhatsApp
 * share and the same list of who has used it. Nothing about sharing was
 * rebuilt for this page; it only answers a question the shop page could not,
 * which is "where are all my codes".
 *
 * One card per shop and never a total, for the reason decision 33 gave for
 * loyalty points: a code earns points at exactly one shop, and a combined
 * figure would invite a customer to think otherwise.
 *
 * Codes are not minted here. A code comes into existence when a customer asks
 * for one on a shop's page, so a customer with none gets an empty state that
 * says where to go rather than a button that quietly creates rows.
 */
export function MyReferralsView() {
  const t = useT(referralDict);
  const { data: shops, isPending, isError } = useMyReferralShops();

  if (isPending) {
    return (
      <div className="grid min-h-[30vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  if (isError) {
    return <p className="text-sm text-live">{t("loadFailed")}</p>;
  }

  if ((shops ?? []).length === 0) {
    return (
      <EmptyState
        icon={<Share2 className="h-6 w-6" />}
        title={t("myEmptyTitle")}
        description={t("myEmptyBody")}
        dashed
        action={
          <Link href="/explore" className="text-sm font-semibold text-accent hover:underline">
            {t("myEmptyCta")}
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {(shops ?? []).map((shop) => (
        <section key={shop.shopId} className="space-y-2.5">
          <Link
            href={`/explore/${shop.shopId}`}
            className="flex items-center gap-2.5 hover:opacity-90"
          >
            <AvatarChip label={shop.shopName} avatarUrl={shop.shopLogoUrl} size={34} />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
              {shop.shopName}
            </p>
          </Link>

          <MyReferralCard
            shopId={shop.shopId}
            shopName={shop.shopName}
            referrerPoints={shop.referrerPoints}
            referredPoints={shop.referredPoints}
            signedIn
            // Unreachable here: this page is behind the customer shell, so
            // there is no session to be missing. The card takes the callback
            // because the shop page — which guests can open — needs it.
            onRequireLogin={() => {}}
          />
        </section>
      ))}
    </div>
  );
}
