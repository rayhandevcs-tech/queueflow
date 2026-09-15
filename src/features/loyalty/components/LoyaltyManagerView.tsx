"use client";

import { useMemo, useState } from "react";
import { Coins, Sparkles, TrendingUp, Users } from "lucide-react";
import type { LoyaltyAccount, Shop } from "@/types";
import { StatTile } from "@/components/ui/StatTile";
import { toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import {
  useLoyaltyActions,
  useLoyaltyCustomerNames,
  useLoyaltySettings,
  useShopLoyaltyAccounts,
} from "../hooks/use-loyalty";
import { loyaltyDict } from "../lib/i18n";
import { isLoyaltyLive, summarize } from "../lib/loyalty";
import { LoyaltyMemberSheet } from "./LoyaltyMemberSheet";
import { LoyaltyMembersTable } from "./LoyaltyMembersTable";
import { LoyaltySettingsCard } from "./LoyaltySettingsCard";

/**
 * The owner's loyalty screen.
 *
 * One screen for both business types, for the same reason membership has one:
 * points are a property of the business, not of how it takes bookings. A
 * salon earns them from finished serials and a parlour from finished
 * appointments, and the trigger handles both — nothing here has to know
 * which.
 *
 * The rules card sits above the table rather than behind a tab, because the
 * first thing an owner does here is switch the programme on, and the second
 * is check it computed what they expected.
 */
export function LoyaltyManagerView({ shop }: { shop: Shop }) {
  const t = useT(loyaltyDict);
  const [openAccount, setOpenAccount] = useState<LoyaltyAccount | null>(null);

  const settings = useLoyaltySettings(shop.id);
  const accounts = useShopLoyaltyAccounts(shop.id);
  const names = useLoyaltyCustomerNames(shop.id);
  const actions = useLoyaltyActions(shop.id);

  const summary = useMemo(() => summarize(accounts.data ?? []), [accounts.data]);
  const live = isLoyaltyLive(settings.data);
  const num = (n: number) => toBanglaDigits(n);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">{t("ownerTitle")}</h1>
        <p className="mt-1 text-[13px] text-muted">{t("ownerSubtitle")}</p>
      </div>

      <LoyaltySettingsCard
        settings={settings.data}
        busy={actions.saveSettings.isPending}
        onSubmit={(values) => actions.saveSettings.mutate(values)}
      />

      {actions.saveSettings.isError && (
        <p className="text-sm text-live">
          {actions.saveSettings.error instanceof Error
            ? actions.saveSettings.error.message
            : t("loadFailed")}
        </p>
      )}

      {/* The tiles only mean something once there is a programme. Showing four
          zeros above a switched-off switch would be noise. */}
      {live && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            value={num(summary.memberCount)}
            label={t("tileMembers")}
            icon={<Users className="h-4 w-4" />}
            accentValue={summary.memberCount > 0 ? "good" : "ink"}
          />
          <StatTile
            value={num(summary.outstandingPoints)}
            label={t("tileOutstanding")}
            icon={<Coins className="h-4 w-4" />}
            accentValue={summary.outstandingPoints > 0 ? "accent" : "ink"}
          />
          <StatTile
            value={num(summary.lifetimePoints)}
            label={t("tileLifetime")}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatTile
            value={num(summary.topBalance)}
            label={t("tileTop")}
            icon={<Sparkles className="h-4 w-4" />}
          />
        </div>
      )}

      {/* The table stays visible even when the programme is paused: points
          already earned still exist and an owner still has to answer for
          them. Only *earning* stops (decision 36 governs visibility to the
          customer, not the owner's own record). */}
      {(live || (accounts.data?.length ?? 0) > 0) && (
        <LoyaltyMembersTable
          accounts={accounts.data}
          names={names.data}
          isPending={accounts.isPending}
          isError={accounts.isError}
          onOpen={setOpenAccount}
        />
      )}

      {openAccount && (
        <LoyaltyMemberSheet
          account={openAccount}
          person={names.data?.get(openAccount.customer_id)}
          actions={actions}
          onClose={() => setOpenAccount(null)}
        />
      )}
    </div>
  );
}
