"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { formatBanglaTime } from "@/lib/format-wait";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { BADGE_VARIANTS } from "@/components/ui/Badge";
import { STATUS_LABEL_KEY, statusStyle } from "../lib/status";
import type { BlockPosition } from "../lib/schedule";
import type { AppointmentCard } from "../lib/types";
import { providerAppointmentsDict } from "../lib/i18n";

/** Below this the block can only carry one line of text. */
const COMPACT_PX = 58;

const SURFACE: Record<string, string> = {
  neutral: "border-line bg-soft",
  accent: "border-accent/30 bg-accent/[0.07]",
  good: "border-good/30 bg-good-soft/70",
  live: "border-live/40 bg-live-soft/80",
  brass: "border-brass/35 bg-brass-soft/70",
  onAccent: "border-line bg-soft",
};

/**
 * One booking, positioned inside its beautician's column.
 *
 * Everything it shows comes from `AppointmentCard`, never from a table — so
 * when Sprint 4 fills that shape with real rows, this component does not
 * change at all.
 */
export function AppointmentBlock({
  appointment,
  position,
  columnHeightPx,
}: {
  appointment: AppointmentCard;
  position: BlockPosition;
  columnHeightPx: number;
}) {
  const t = useT(providerAppointmentsDict);
  const style = statusStyle(appointment.status);
  const heightPx = (position.heightPct / 100) * columnHeightPx;
  const compact = heightPx < COMPACT_PX;

  const start = formatBanglaTime(new Date(appointment.startsAt));
  const end = formatBanglaTime(new Date(appointment.endsAt));
  const services = appointment.serviceNames.join(", ");
  const statusLabel = t(STATUS_LABEL_KEY[appointment.status]);

  return (
    <article
      className={cn(
        "absolute inset-x-1 overflow-hidden rounded-xl border px-2 py-1.5 shadow-xs",
        SURFACE[style.tone] ?? SURFACE.neutral,
        style.vacated && "opacity-55",
      )}
      style={{ top: `${position.topPct}%`, height: `${position.heightPct}%` }}
      // One label rather than a pile of nested text: at 30 minutes tall the
      // block itself shows almost nothing, so the accessible name has to
      // carry the whole booking.
      aria-label={[
        appointment.customerName,
        services,
        `${start} – ${end}`,
        statusLabel,
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      {compact ? (
        <p className="flex items-baseline gap-1.5 truncate text-[11px] leading-tight">
          <span className="font-number font-semibold text-muted">{start}</span>
          <span
            className={cn("truncate font-semibold text-ink", style.vacated && "line-through")}
          >
            {appointment.customerName}
          </span>
        </p>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <AvatarChip
              label={appointment.customerName}
              avatarUrl={appointment.customerAvatarUrl}
              shape="circle"
              size={20}
            />
            <p
              className={cn(
                "min-w-0 flex-1 truncate text-[12px] font-bold text-ink",
                style.vacated && "line-through",
              )}
            >
              {appointment.customerName}
            </p>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                BADGE_VARIANTS[style.tone],
              )}
            >
              {/* Only the booking actually being worked on pulses — the whole
                  block flashing would make a busy day unreadable. */}
              {style.pulse && <span className="h-1 w-1 rounded-full bg-live animate-pulse-live" />}
              {statusLabel}
            </span>
          </div>

          {services && (
            <p className="mt-0.5 truncate text-[11px] text-muted">{services}</p>
          )}

          <p className="mt-0.5 flex items-center gap-1 truncate font-number text-[11px] text-muted">
            {start} – {end}
            {(position.clippedEnd || position.clippedStart) && (
              <AlertTriangle
                className="h-3 w-3 shrink-0 text-brass"
                aria-label={position.clippedEnd ? t("runsPastClose") : t("startsBeforeOpen")}
              />
            )}
          </p>
        </>
      )}
    </article>
  );
}
