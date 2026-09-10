"use client";

import { useState } from "react";
import { Crown, Plus, Trash2 } from "lucide-react";
import type { CustomerMembership, MembershipTier } from "@/types";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Switch } from "@/components/ui/Switch";
import { toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { useTierMutations, useTiers } from "../hooks/use-tiers";
import { membershipDict } from "../lib/i18n";
import { isLiveStatus } from "../lib/membership";
import { TierCard } from "./TierCard";
import { TierForm } from "./TierForm";

/**
 * The owner's packages.
 *
 * Deactivate is the prominent action and delete is tucked behind a confirm,
 * because switching a tier off is almost always what an owner means: it stops
 * new sales while everyone who already paid keeps their term. Deleting is only
 * possible for a tier nobody bought — the FK refuses the rest, and the sheet
 * says so rather than letting the button look broken.
 */
export function MembershipTiersManager({
  shopId,
  memberships,
}: {
  shopId: string;
  /** Only to show "n members" per tier — the list itself lives next door. */
  memberships: CustomerMembership[] | undefined;
}) {
  const t = useT(membershipDict);
  const { data: tiers, isPending } = useTiers(shopId);
  const { create, update, remove, toggleActive, seedPresets } = useTierMutations(shopId);
  const [editing, setEditing] = useState<MembershipTier | "new" | null>(null);
  const [deleting, setDeleting] = useState<MembershipTier | null>(null);

  const liveCountFor = (tierId: string) =>
    (memberships ?? []).filter((m) => m.tier_id === tierId && isLiveStatus(m.status)).length;

  if (isPending) {
    return (
      <div className="grid min-h-32 place-items-center">
        <Spinner className="h-5 w-5 text-muted" />
      </div>
    );
  }

  const nextSortOrder = Math.max(-1, ...(tiers ?? []).map((tier) => tier.sort_order)) + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{t("tiersHeading")}</h2>
        </div>
        {editing === null && (tiers?.length ?? 0) > 0 && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
          >
            <Plus className="h-4 w-4" />
            {t("newTierCta")}
          </button>
        )}
      </div>

      {editing !== null && (
        <TierForm
          initial={editing === "new" ? undefined : editing}
          nextSortOrder={nextSortOrder}
          busy={create.isPending || update.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={(values) => {
            if (editing === "new") {
              create.mutate(values, { onSuccess: () => setEditing(null) });
            } else {
              update.mutate(
                { tierId: editing.id, values },
                { onSuccess: () => setEditing(null) },
              );
            }
          }}
        />
      )}

      {(create.isError || update.isError || remove.isError) && (
        <p className="text-sm text-live">
          {(create.error ?? update.error ?? remove.error) instanceof Error
            ? (create.error ?? update.error ?? remove.error)!.message
            : t("loadFailed")}
        </p>
      )}

      {/* The whole membership programme starts here, so the empty state is the
          one place that explains the trade: no packages means customers see
          nothing at all (decision 36), and the four familiar ones are a tap
          away rather than something the migration decided for them. */}
      {(tiers?.length ?? 0) === 0 && editing === null ? (
        <EmptyState
          icon={<Crown className="h-6 w-6" />}
          title={t("noTiersTitle")}
          description={t("noTiersDesc")}
          action={
            <div className="flex flex-col items-center gap-2">
              <Button onClick={() => seedPresets.mutate()} loading={seedPresets.isPending}>
                {t("seedPresetsCta")}
              </Button>
              <p className="max-w-sm text-[11px] leading-snug text-muted">
                {t("seedPresetsHint")}
              </p>
              <button
                type="button"
                onClick={() => setEditing("new")}
                className="text-[13px] font-semibold text-accent hover:underline"
              >
                {t("newTierCta")}
              </button>
            </div>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {tiers?.map((tier) => {
            const liveCount = liveCountFor(tier.id);
            return (
              <TierCard
                key={tier.id}
                name={tier.name}
                description={tier.description}
                price={tier.price}
                durationDays={tier.duration_days}
                benefits={tier.benefits}
                inactive={!tier.is_active}
                footer={
                  <div className="space-y-2 border-t border-line pt-2.5">
                    <p className="text-[11px] font-semibold text-muted">
                      {t("tierMembersCount", toBanglaDigits(liveCount))}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing(tier)}
                          className="text-[13px] font-semibold text-accent hover:underline"
                        >
                          {t("editTier")}
                        </button>
                        {liveCount === 0 && (
                          <button
                            type="button"
                            onClick={() => setDeleting(tier)}
                            aria-label={t("deleteTier")}
                            className="text-muted transition-colors hover:text-live"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <Switch
                        checked={tier.is_active}
                        disabled={toggleActive.isPending}
                        onChange={(next) =>
                          toggleActive.mutate({ tierId: tier.id, isActive: next })
                        }
                      />
                    </div>
                  </div>
                }
              />
            );
          })}
        </div>
      )}

      {deleting && (
        <ConfirmSheet
          open
          title={t("deleteTierTitle")}
          description={
            liveCountFor(deleting.id) > 0 ? t("deleteTierBlocked") : t("deleteTierBody")
          }
          confirmLabel={t("deleteTier")}
          cancelLabel={t("cancel")}
          variant="danger"
          loading={remove.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={() =>
            remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
          }
        />
      )}
    </div>
  );
}
