"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Phone, Play, UserX } from "lucide-react";
import { parseServicesSnapshot, type Serial } from "@/types";
import { useNowMs } from "@/hooks/use-now";
import { fmtWait, formatMoney } from "@/lib/format-wait";
import { UiDbError } from "@/lib/supabase/db-errors";
import { cn } from "@/lib/utils";
import type { Lane } from "../lib/lanes";
import type { useSerialActions } from "../hooks/use-serial-actions";
import { MoveSerialMenu } from "./MoveSerialMenu";

export function WaitingRow({
  serial,
  canStart,
  lanes,
  actions,
}: {
  serial: Serial;
  canStart: boolean;
  lanes: Lane[];
  actions: ReturnType<typeof useSerialActions>;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const nowMs = useNowMs(30_000);
  const services = parseServicesSnapshot(serial.services_snapshot);

  const startsInSec = serial.estimated_start_at
    ? (new Date(serial.estimated_start_at).getTime() - nowMs) / 1000
    : 0;

  const surface = (err: unknown) => {
    if (err instanceof UiDbError && err.silent) return;
    setError(err instanceof Error ? err.message : "কিছু একটা ভুল হয়েছে");
  };
  const run = (fn: () => void) => {
    setError(null);
    fn();
  };

  return (
    <div className="rounded-2xl border border-line bg-card p-3.5">
      <div className="flex items-center gap-4">
        <div className="grid h-9.5 w-9.5 shrink-0 place-items-center rounded-xl bg-soft font-number text-base font-bold text-ink">
          {serial.position}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-base font-bold text-ink">
              {serial.customer_name || "—"}
            </span>
            {serial.is_walk_in && (
              <span className="shrink-0 rounded-full bg-soft px-2 py-0.5 text-[10px] font-semibold text-muted">
                ওয়াক-ইন
              </span>
            )}
            {serial.advance_paid && (
              <span className="shrink-0 rounded-full bg-good-soft px-2 py-0.5 text-[10px] font-semibold text-good">
                ✓ অ্যাডভান্স পেইড
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">
            {services.map((s) => s.name).join(" + ") || "—"}
          </p>
        </div>
        <div className="min-w-19.5 text-center">
          <p className="text-[11px] text-muted">শুরু হবে</p>
          <p className="font-number text-base font-bold text-live">
            {fmtWait(startsInSec).label}
          </p>
        </div>
        <div className="min-w-13.5 text-right font-number text-[15px] font-semibold text-ink">
          ৳{formatMoney(serial.total_amount)}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2 border-t border-line pt-2.5">
        {serial.customer_phone && (
          <a
            href={`tel:${serial.customer_phone}`}
            className="flex items-center gap-1 text-xs font-medium text-accent"
          >
            <Phone className="h-3 w-3" />
            {serial.customer_phone}
          </a>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {serial.customer_id && (
            <button
              type="button"
              title="কাস্টমারকে মেসেজ করো"
              onClick={() => router.push(`/chat/${serial.customer_id}`)}
              className="grid h-7 w-7 place-items-center rounded-lg bg-soft text-muted hover:text-ink"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </button>
          )}
          {canStart && (
            <button
              type="button"
              disabled={actions.start.isPending}
              onClick={() => run(() => actions.start.mutate(serial.id, { onError: surface }))}
              className={cn(
                "flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-xs font-semibold text-accent-ink disabled:opacity-50",
              )}
            >
              <Play className="h-3 w-3 fill-current" />
              শুরু
            </button>
          )}
          <button
            type="button"
            title="No-show"
            disabled={actions.noShow.isPending}
            onClick={() => run(() => actions.noShow.mutate(serial.id, { onError: surface }))}
            className="grid h-7 w-7 place-items-center rounded-lg bg-brass-soft text-brass disabled:opacity-50"
          >
            <UserX className="h-3.5 w-3.5" />
          </button>
          <MoveSerialMenu
            serial={serial}
            lanes={lanes}
            moving={actions.move.isPending}
            onMove={(targetChairId) =>
              run(() => actions.move.mutate({ serialId: serial.id, targetChairId }, { onError: surface }))
            }
          />
        </div>
      </div>

      {error && <p className="mt-1.5 text-xs text-live">{error}</p>}
    </div>
  );
}
