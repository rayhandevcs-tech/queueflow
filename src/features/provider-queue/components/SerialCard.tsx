"use client";

import { Phone, Play } from "lucide-react";
import { parseServicesSnapshot, type Serial } from "@/types";
import { cn } from "@/lib/utils";
import { useElapsed } from "../hooks/use-elapsed";
import { SerialActions } from "./SerialActions";
import type { Lane } from "../lib/lanes";
import type { useSerialActions } from "../hooks/use-serial-actions";

interface Props {
  serial: Serial;
  canStart: boolean;
  lanes: Lane[];
  actions: ReturnType<typeof useSerialActions>;
}

export function SerialCard({ serial, canStart, lanes, actions }: Props) {
  const inProgress = serial.status === "IN_PROGRESS";
  const elapsed = useElapsed(inProgress ? serial.started_at : null);
  const services = parseServicesSnapshot(serial.services_snapshot);

  return (
    <div
      className={cn(
        "space-y-2 rounded-xl border bg-card p-3 shadow-xs transition-shadow",
        inProgress
          ? "border-good/40 shadow-sm ring-2 ring-good-soft"
          : "border-line hover:shadow-sm",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold",
            inProgress ? "bg-good text-accent-ink" : "bg-soft text-ink",
          )}
        >
          {inProgress ? <Play className="h-3 w-3 fill-current" /> : serial.position}
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
            {serial.customer_name || "No name"}
            {serial.is_walk_in && (
              <span className="rounded bg-soft px-1.5 py-0.5 text-[10px] font-medium text-muted">
                Walk-in
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted">
            {services.map((s) => s.name).join(" + ") || "—"}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs font-semibold text-ink">
            ৳{serial.total_amount}
          </p>
          <p className="text-[11px] text-muted">
            {inProgress
              ? `${elapsed} min elapsed`
              : `~${serial.estimated_duration_min} min`}
          </p>
        </div>
      </div>

      {serial.customer_phone && (
        <a
          href={`tel:${serial.customer_phone}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent"
        >
          <Phone className="h-3 w-3" />
          {serial.customer_phone}
        </a>
      )}

      <SerialActions
        serial={serial}
        variant={inProgress ? "in-progress" : "waiting"}
        canStart={canStart}
        lanes={lanes}
        actions={actions}
      />
    </div>
  );
}
