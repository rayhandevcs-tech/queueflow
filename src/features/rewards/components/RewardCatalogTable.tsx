"use client";

import { useMemo, useState } from "react";
import { Gift } from "lucide-react";
import type { Reward, Service } from "@/types";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { Switch } from "@/components/ui/Switch";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { rewardsDict } from "../lib/i18n";
import { isRewardAvailable, sortRewards } from "../lib/rewards";

/**
 * The owner's catalogue.
 *
 * Every switched-off and sold-out reward stays in the table. A shelf the owner
 * can see the whole of is the only way to answer "why isn't my reward
 * showing" — hiding the unavailable ones would make the screen agree with the
 * customer's view and disagree with reality.
 *
 * The state column says *which* of the three reasons applies, because they
 * need three different fixes: switch it on, restock it, or move the date.
 */
export function RewardCatalogTable({
  rewards,
  services,
  isPending,
  isError,
  busy,
  onEdit,
  onToggleActive,
}: {
  rewards: Reward[] | undefined;
  services: Service[] | undefined;
  isPending: boolean;
  isError: boolean;
  busy: boolean;
  onEdit: (reward: Reward) => void;
  onToggleActive: (reward: Reward, next: boolean) => void;
}) {
  const t = useT(rewardsDict);
  // One clock reading per mount, held in state. Reading `Date.now()` during
  // render is impure — the same row could say "expired" and "live" on two
  // renders of the same second, and the React Compiler refuses it outright.
  const [now] = useState(() => new Date());
  const rows = useMemo(() => sortRewards(rewards ?? []), [rewards]);
  const num = (n: number) => toBanglaDigits(n);
  const serviceName = (id: string | null) =>
    services?.find((service) => service.id === id)?.name ?? "";

  const worth = (reward: Reward) => {
    if (reward.kind === "DISCOUNT_FLAT") return t("valueFlat", num(reward.value ?? 0));
    if (reward.kind === "DISCOUNT_PCT") return t("valuePct", num(reward.value ?? 0));
    return t("valueFree", serviceName(reward.service_id));
  };

  const nameCell = (reward: Reward) => (
    <div className="min-w-0">
      <p className="truncate font-semibold text-ink">{reward.name}</p>
      <p className="truncate text-[11px] text-muted">{worth(reward)}</p>
    </div>
  );

  /** One pill, naming the reason that is actually true. */
  const stateCell = (reward: Reward) => {
    if (!reward.is_active) {
      return <StatusPill tone="neutral" dot={false} label={t("inactiveState")} />;
    }
    if (reward.valid_until && new Date(reward.valid_until).getTime() < now.getTime()) {
      return <StatusPill tone="brass" dot={false} label={t("offerExpired")} />;
    }
    if (reward.stock != null && reward.stock <= 0) {
      return <StatusPill tone="brass" dot={false} label={t("outOfStock")} />;
    }
    return <StatusPill tone="good" label={t("activeState")} />;
  };

  const columns: DataTableColumn<Reward>[] = [
    { id: "reward", header: t("colReward"), cell: nameCell },
    {
      id: "cost",
      header: t("colCost"),
      className: "text-right",
      cell: (reward) => (
        <span className="font-display text-[15px] font-bold whitespace-nowrap text-accent">
          {num(reward.points_cost)}
        </span>
      ),
    },
    {
      id: "stock",
      header: t("colStock"),
      className: "text-right",
      cell: (reward) => (
        <span className="text-muted">
          {reward.stock == null ? t("unlimited") : num(reward.stock)}
        </span>
      ),
    },
    { id: "state", header: t("colState"), cell: stateCell },
    {
      id: "switch",
      header: "",
      className: "text-right",
      cell: (reward) => (
        <span
          // The row itself opens the editor; the switch must not do both.
          onClick={(event) => event.stopPropagation()}
        >
          <Switch
            checked={reward.is_active}
            disabled={busy}
            onChange={(next) => onToggleActive(reward, next)}
          />
        </span>
      ),
    },
  ];

  if (isError) {
    return <p className="py-10 text-center text-sm text-live">{t("loadFailed")}</p>;
  }

  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-bold text-ink">{t("catalogueHeading")}</h2>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(reward) => reward.id}
        loading={isPending}
        onRowClick={onEdit}
        emptyIcon={<Gift className="h-6 w-6" />}
        emptyTitle={t("emptyTitle")}
        emptyDescription={t("emptyBody")}
        mobileCard={(reward) => (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              {nameCell(reward)}
              <div className="mt-1 flex items-center gap-1.5">
                {stateCell(reward)}
                {reward.valid_until && (
                  <span className="text-[10px] text-muted">
                    {t("validTill", formatBanglaDate(new Date(reward.valid_until)))}
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-[15px] font-bold text-accent">
                {num(reward.points_cost)}
              </p>
              <p className="text-[10px] text-muted">
                {reward.stock == null ? t("unlimited") : t("stockLeft", num(reward.stock))}
              </p>
            </div>
          </div>
        )}
      />
      {/* A quiet count of what a customer would actually see right now. */}
      {rows.length > 0 && (
        <p className="px-1 text-[11px] text-muted">
          {t("tileAvailable")}:{" "}
          {num(rows.filter((reward) => isRewardAvailable(reward, now)).length)} /{" "}
          {num(rows.length)}
        </p>
      )}
    </div>
  );
}
