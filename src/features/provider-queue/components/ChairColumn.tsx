"use client";

import { Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Lane } from "../lib/lanes";
import type { useSerialActions } from "../hooks/use-serial-actions";
import { SerialCard } from "./SerialCard";
import { EmptyLane } from "./EmptyLane";

interface Props {
  lane: Lane;
  lanes: Lane[];
  actions: ReturnType<typeof useSerialActions>;
}

export function ChairColumn({ lane, lanes, actions }: Props) {
  const { chair } = lane;
  const count = lane.waiting.length + (lane.inProgress ? 1 : 0);

  return (
    <section
      className={cn(
        "flex w-72 shrink-0 flex-col gap-2.5 rounded-2xl bg-soft/70 p-3 shadow-xs md:w-auto md:shrink",
        lane.chairInactive && "opacity-60",
      )}
      style={{ boxShadow: `inset 0 3px 0 0 ${chair.color ?? "#cbd5e1"}` }}
    >
      <header className="flex items-center gap-2 px-1 pt-0.5">
        {chair.staff_avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={chair.staff_avatar_url}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-2 ring-card"
          />
        ) : (
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-accent-ink ring-2 ring-card"
            style={{ backgroundColor: chair.color ?? "#94a3b8" }}
          >
            {(chair.staff_name || chair.label).slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">
            {chair.staff_name || chair.label}
          </p>
          <p className="flex items-center gap-1 truncate text-[11px] text-muted">
            {lane.chairInactive ? (
              <>
                <Pause className="h-3 w-3" />
                Paused — won&apos;t get new serials
              </>
            ) : (
              `Backlog ≈ ${lane.backlogMin} min`
            )}
          </p>
        </div>
        <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-card px-1.5 text-xs font-bold text-ink shadow-xs">
          {count}
        </span>
      </header>

      {lane.inProgress && (
        <SerialCard
          serial={lane.inProgress}
          canStart={false}
          lanes={lanes}
          actions={actions}
        />
      )}

      {lane.waiting.map((serial, index) => (
        <SerialCard
          key={serial.id}
          serial={serial}
          canStart={lane.canStart && index === 0}
          lanes={lanes}
          actions={actions}
        />
      ))}

      {!lane.inProgress && lane.waiting.length === 0 && <EmptyLane />}
    </section>
  );
}
