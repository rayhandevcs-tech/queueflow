"use client";

import { useState } from "react";
import { Check, ChevronDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { useT } from "@/lib/i18n";
import { providerCatalogDict } from "../lib/i18n";
import { useChairs } from "../hooks/use-chairs";
import { useServices } from "../hooks/use-services";
import {
  useCanPerformMutation,
  useChairStats,
} from "../hooks/use-chair-stats";

/**
 * Rows = active services, columns = chairs (staff).
 * A cell toggles chair_service_stats.can_perform — the DB's assignment
 * function reads exactly this to decide eligibility.
 *
 * Desktop keeps the table (staff photo now in the header, replacing the
 * plain color bar). Mobile swaps to one accordion card per staff member —
 * a wide table doesn't fit small screens, so each chair's row becomes a
 * collapsible toggle list instead.
 */
export function CanPerformMatrix({ shopId }: { shopId: string }) {
  const { data: chairs } = useChairs(shopId);
  const { data: services } = useServices(shopId);
  const { data: stats } = useChairStats(shopId);
  const toggle = useCanPerformMutation(shopId);
  const t = useT(providerCatalogDict);
  const [openChairId, setOpenChairId] = useState<string | null>(null);

  const activeServices = services?.filter((s) => s.is_active) ?? [];

  if (!chairs?.length || !activeServices.length) {
    return (
      <p className="rounded-xl bg-soft p-3 text-xs text-muted">{t("canPerformGuardHint")}</p>
    );
  }

  const canPerform = (chairId: string, serviceId: string) =>
    stats?.find(
      (r) => r.chair_id === chairId && r.service_id === serviceId,
    )?.can_perform ?? true;

  return (
    <>
      <div className="space-y-2.5 md:hidden">
        {chairs.map((c) => {
          const open = openChairId === c.id;
          const capableCount = activeServices.filter((s) => canPerform(c.id, s.id)).length;
          return (
            <div key={c.id} className="overflow-hidden rounded-2xl border border-line bg-card">
              <button
                type="button"
                onClick={() => setOpenChairId(open ? null : c.id)}
                className="flex w-full items-center gap-3 p-3.5 text-left"
              >
                <AvatarChip
                  label={c.staff_name || c.label}
                  avatarUrl={c.staff_avatar_url}
                  shape="circle"
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{c.staff_name || c.label}</p>
                  <p className="text-xs text-muted">{t("capableCount", capableCount, activeServices.length)}</p>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4.5 w-4.5 shrink-0 text-muted transition-transform duration-150",
                    open && "rotate-180",
                  )}
                />
              </button>
              {open && (
                <ul className="border-t border-line">
                  {activeServices.map((s) => {
                    const on = canPerform(c.id, s.id);
                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 border-b border-line p-3.5 last:border-0"
                      >
                        <span className="min-w-0 truncate text-sm text-ink">{s.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            toggle.mutate({ chairId: c.id, serviceId: s.id, canPerform: !on })
                          }
                          className={cn(
                            "grid h-7 w-7 shrink-0 place-items-center rounded-lg border transition-colors",
                            on
                              ? "border-good bg-good-soft text-good"
                              : "border-line bg-soft text-muted",
                          )}
                          aria-label={`${c.staff_name || c.label} — ${s.name}`}
                        >
                          {on ? <Check className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-line bg-card shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="p-3 text-left text-xs font-semibold text-muted">
                {t("matrixHeader")}
              </th>
              {chairs.map((c) => (
                <th key={c.id} className="p-3 text-center">
                  <AvatarChip
                    label={c.staff_name || c.label}
                    avatarUrl={c.staff_avatar_url}
                    shape="circle"
                    size={36}
                    className="mx-auto mb-1"
                  />
                  <span className="text-xs font-semibold text-ink">
                    {c.staff_name || c.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeServices.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0">
                <td className="p-3 font-medium text-ink">{s.name}</td>
                {chairs.map((c) => {
                  const on = canPerform(c.id, s.id);
                  return (
                    <td key={c.id} className="p-3 text-center">
                      <button
                        onClick={() =>
                          toggle.mutate({
                            chairId: c.id,
                            serviceId: s.id,
                            canPerform: !on,
                          })
                        }
                        className={cn(
                          "grid h-7 w-7 place-items-center rounded-lg border transition-colors",
                          on
                            ? "border-good bg-good-soft text-good"
                            : "border-line bg-soft text-muted",
                        )}
                        aria-label={`${c.label} — ${s.name}`}
                      >
                        {on ? <Check className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
