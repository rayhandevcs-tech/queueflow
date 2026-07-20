"use client";

import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChairs } from "../hooks/use-chairs";
import { useServices } from "../hooks/use-services";
import {
  useCanPerformMutation,
  useChairStats,
} from "../hooks/use-chair-stats";

/**
 * Rows = active services, columns = chairs.
 * A cell toggles chair_service_stats.can_perform — the DB's assignment
 * function reads exactly this to decide eligibility.
 */
export function CanPerformMatrix({ shopId }: { shopId: string }) {
  const { data: chairs } = useChairs(shopId);
  const { data: services } = useServices(shopId);
  const { data: stats } = useChairStats(shopId);
  const toggle = useCanPerformMutation(shopId);

  const activeServices = services?.filter((s) => s.is_active) ?? [];

  if (!chairs?.length || !activeServices.length) {
    return (
      <p className="rounded-xl bg-soft p-3 text-xs text-muted">
        You need at least one chair and one active service to see the matrix.
      </p>
    );
  }

  const canPerform = (chairId: string, serviceId: string) =>
    stats?.find(
      (r) => r.chair_id === chairId && r.service_id === serviceId,
    )?.can_perform ?? true;

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="p-3 text-left text-xs font-semibold text-muted">
              Service ↓ / Chair →
            </th>
            {chairs.map((c) => (
              <th key={c.id} className="p-3 text-center">
                <span
                  className="mx-auto mb-1 block h-2 w-8 rounded-full"
                  style={{ backgroundColor: c.color ?? "#cbd5e1" }}
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
  );
}
