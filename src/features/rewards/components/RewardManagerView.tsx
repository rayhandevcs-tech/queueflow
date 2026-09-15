"use client";

import { useMemo, useState } from "react";
import { Coins, Gift, Lock, Plus, Ticket } from "lucide-react";
import type { LoyaltySettings, Reward, Service, Shop } from "@/types";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { StatTile } from "@/components/ui/StatTile";
import { toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { useRewardActions, useShopRedemptions, useShopRewards } from "../hooks/use-rewards";
import { rewardsDict } from "../lib/i18n";
import { summarizeCatalogue } from "../lib/rewards";
import { RedemptionVerifySheet } from "./RedemptionVerifySheet";
import { RewardCatalogTable } from "./RewardCatalogTable";
import { RewardForm } from "./RewardForm";

/**
 * The owner's rewards screen.
 *
 * One screen for both business types, for the fourth sprint in a row and the
 * same reason: a reward is a property of the business, not of how it takes
 * bookings. A salon honours one on a finished serial and a parlour on a
 * finished appointment, and the same trigger handles both.
 *
 * The loyalty settings and the service list come in as props rather than
 * being fetched here — they belong to the loyalty and catalogue features, and
 * `eslint-plugin-boundaries` forbids one feature reading another's hooks. It
 * is also the honest shape of the dependency: a reward is bought with loyalty
 * points and may name a service, and rewards owns neither.
 */
export function RewardManagerView({
  shop,
  loyaltySettings,
  services,
  loyaltyHref = "/loyalty",
}: {
  shop: Shop;
  loyaltySettings: LoyaltySettings | null | undefined;
  services: Service[] | undefined;
  loyaltyHref?: string;
}) {
  const t = useT(rewardsDict);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [creating, setCreating] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const rewards = useShopRewards(shop.id);
  const redemptions = useShopRedemptions(shop.id);
  const actions = useRewardActions(shop.id);

  const [now] = useState(() => new Date());
  const summary = useMemo(
    () => summarizeCatalogue(rewards.data ?? [], now),
    [rewards.data, now],
  );
  const nextSortOrder = useMemo(
    () => Math.max(0, ...(rewards.data ?? []).map((reward) => reward.sort_order)) + 1,
    [rewards.data],
  );

  const num = (n: number) => toBanglaDigits(n);
  const busy = actions.create.isPending || actions.update.isPending;
  // Points off means nobody is earning any, so there is nothing to spend.
  const pointsOn = !!loyaltySettings?.is_enabled;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[27px] font-bold text-ink">{t("ownerTitle")}</h1>
          <p className="mt-1 text-[13px] text-muted">{t("ownerSubtitle")}</p>
        </div>
      </div>

      {/* Rewards without points are a shop selling tickets to a lottery it
          never runs. Say so, and say where to fix it. */}
      {!pointsOn && (
        <div className="space-y-2 rounded-2xl border border-line bg-card p-4 shadow-xs">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <Lock className="h-3.5 w-3.5 text-brass" />
            {t("needsLoyaltyTitle")}
          </p>
          <p className="text-[12px] leading-snug text-muted">{t("needsLoyaltyBody")}</p>
          <a
            href={loyaltyHref}
            className="inline-block text-[13px] font-semibold text-accent hover:underline"
          >
            {t("goToLoyalty")}
          </a>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          {t("newReward")}
        </Button>
        <Button variant="outline" onClick={() => setVerifying(true)}>
          <Ticket className="h-4 w-4" />
          {t("verifyCta")}
        </Button>
      </div>

      {/* The tiles only mean something once there is a catalogue. Four zeros
          above an empty table would be noise. */}
      {(rewards.data?.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            value={num(summary.total)}
            label={t("tileTotal")}
            icon={<Gift className="h-4 w-4" />}
          />
          <StatTile
            value={num(summary.available)}
            label={t("tileAvailable")}
            icon={<Gift className="h-4 w-4" />}
            accentValue={summary.available > 0 ? "good" : "ink"}
          />
          <StatTile
            value={summary.cheapest > 0 ? num(summary.cheapest) : "—"}
            label={t("tileCheapest")}
            icon={<Coins className="h-4 w-4" />}
          />
          <StatTile
            value={num(redemptions.data?.length ?? 0)}
            label={t("tileIssued")}
            icon={<Ticket className="h-4 w-4" />}
            accentValue={(redemptions.data?.length ?? 0) > 0 ? "accent" : "ink"}
          />
        </div>
      )}

      {(actions.create.isError || actions.update.isError || actions.toggleActive.isError) && (
        <p className="text-sm text-live">
          {errorText(
            actions.create.error ?? actions.update.error ?? actions.toggleActive.error,
            t("loadFailed"),
          )}
        </p>
      )}

      <RewardCatalogTable
        rewards={rewards.data}
        services={services}
        isPending={rewards.isPending}
        isError={rewards.isError}
        busy={actions.toggleActive.isPending}
        onEdit={setEditing}
        onToggleActive={(reward, next) =>
          actions.toggleActive.mutate({ rewardId: reward.id, isActive: next })
        }
      />

      <BottomSheet
        open={creating}
        onClose={() => setCreating(false)}
        title={t("formNewTitle")}
        maxWidthClassName="max-w-md"
      >
        <RewardForm
          services={services}
          nextSortOrder={nextSortOrder}
          busy={busy}
          onCancel={() => setCreating(false)}
          onSubmit={(values) =>
            actions.create.mutate(values, { onSuccess: () => setCreating(false) })
          }
        />
      </BottomSheet>

      <BottomSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={t("formEditTitle")}
        maxWidthClassName="max-w-md"
      >
        {editing && (
          <RewardForm
            initial={editing}
            services={services}
            nextSortOrder={editing.sort_order}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSubmit={(values) =>
              actions.update.mutate(
                { rewardId: editing.id, values },
                { onSuccess: () => setEditing(null) },
              )
            }
          />
        )}
      </BottomSheet>

      <RedemptionVerifySheet
        shopId={shop.id}
        open={verifying}
        onClose={() => setVerifying(false)}
      />
    </div>
  );
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
