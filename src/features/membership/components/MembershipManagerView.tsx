"use client";

import { useState } from "react";
import { CalendarClock, Coins, Crown, UserPlus, Users } from "lucide-react";
import type { CustomerMembership, Shop } from "@/types";
import { cn } from "@/lib/utils";
import { StatTile } from "@/components/ui/StatTile";
import { useLanguage, useT } from "@/lib/i18n";
import { useTerms } from "@/lib/business-terms";
import { toBanglaDigits } from "@/lib/format-wait";
import {
  useMembershipActions,
  useMembershipSummary,
  useShopMemberships,
} from "../hooks/use-memberships";
import { useTiers } from "../hooks/use-tiers";
import { membershipDict } from "../lib/i18n";
import { EnrollMemberSheet } from "./EnrollMemberSheet";
import { MemberSheet } from "./MemberSheet";
import { MembersTable } from "./MembersTable";
import { MembershipTiersManager } from "./MembershipTiersManager";

type Tab = "tiers" | "members";

/**
 * The owner's membership screen.
 *
 * One screen for both business types, because membership is a property of the
 * business and not of how it takes bookings — a salon running a live queue and
 * a parlour running appointments sell the same thing here. The only difference
 * the page draws is vocabulary, through `useTerms`, and it is one word in one
 * subtitle. Building `SalonMembership` and `ParlourMembership` would have
 * doubled the table, the RLS and this screen to say the same sentence twice.
 *
 * Two tabs rather than two pages: an owner setting up their programme moves
 * between "what do I sell" and "who bought it" constantly, and the four tiles
 * above them belong to both.
 */
export function MembershipManagerView({ shop }: { shop: Shop }) {
  const t = useT(membershipDict);
  const { language } = useLanguage();
  const tt = useTerms(shop.business_type, language);
  const [tab, setTab] = useState<Tab>("members");
  const [openMember, setOpenMember] = useState<CustomerMembership | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const memberships = useShopMemberships(shop.id);
  const { data: summary } = useMembershipSummary(shop.id);
  const { data: tiers } = useTiers(shop.id);
  const actions = useMembershipActions(shop.id);

  const hasTiers = (tiers?.length ?? 0) > 0;
  // Start on the tiers tab when there is nothing to sell yet: a members list
  // that cannot possibly have anyone in it is not the useful first screen.
  const activeTab: Tab = hasTiers ? tab : "tiers";

  const num = (n: number | undefined) => toBanglaDigits(n ?? 0);

  const TABS: readonly { id: Tab; label: string }[] = [
    { id: "members", label: t("tabMembers") },
    { id: "tiers", label: t("tabTiers") },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[27px] font-bold text-ink">{t("ownerTitle")}</h1>
          <p className="mt-1 text-[13px] text-muted">{t("ownerSubtitle")}</p>
        </div>
        {hasTiers && (
          <button
            type="button"
            onClick={() => setEnrolling(true)}
            className="flex items-center gap-1.5 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-accent/50"
          >
            <UserPlus className="h-4 w-4" />
            {t("enrollCta")}
          </button>
        )}
      </div>

      {hasTiers && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            value={num(summary?.activeCount)}
            label={t("tileActive")}
            icon={<Users className="h-4 w-4" />}
            accentValue={(summary?.activeCount ?? 0) > 0 ? "good" : "ink"}
          />
          <StatTile
            value={num(summary?.pendingCount)}
            label={t("tilePending")}
            icon={<Crown className="h-4 w-4" />}
            accentValue={(summary?.pendingCount ?? 0) > 0 ? "accent" : "ink"}
          />
          <StatTile
            value={num(summary?.expiringSoon)}
            label={t("tileExpiring")}
            icon={<CalendarClock className="h-4 w-4" />}
            accentValue={(summary?.expiringSoon ?? 0) > 0 ? "brass" : "ink"}
          />
          <StatTile
            value={num(summary?.unpaidCount)}
            label={t("tileUnpaid")}
            icon={<Coins className="h-4 w-4" />}
            accentValue={(summary?.unpaidCount ?? 0) > 0 ? "brass" : "ink"}
          />
        </div>
      )}

      {hasTiers && (
        <div className="flex gap-1.5 rounded-xl bg-soft p-1">
          {TABS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={activeTab === option.id}
              onClick={() => setTab(option.id)}
              className={cn(
                "flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
                activeTab === option.id ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {activeTab === "members" ? (
        <MembersTable
          memberships={memberships.data}
          isPending={memberships.isPending}
          isError={memberships.isError}
          onOpen={setOpenMember}
        />
      ) : (
        <MembershipTiersManager shopId={shop.id} memberships={memberships.data} />
      )}

      {/* The one place the business type shows up at all — and only because a
          salon owner reading "বিউটিশিয়ান" would think they were on the wrong
          screen. */}
      {hasTiers && activeTab === "members" && (
        <p className="text-center text-[11px] text-muted">
          {tt("venue")} · {t("ownerTitle")}
        </p>
      )}

      {openMember && (
        <MemberSheet
          membership={openMember}
          shopId={shop.id}
          actions={actions}
          onClose={() => setOpenMember(null)}
        />
      )}

      {enrolling && (
        <EnrollMemberSheet
          shopId={shop.id}
          tiers={tiers}
          memberships={memberships.data}
          actions={actions}
          onClose={() => setEnrolling(false)}
          onDone={() => setEnrolling(false)}
        />
      )}
    </div>
  );
}
