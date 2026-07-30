"use client";

import { Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { Lane } from "../lib/lanes";
import type { useSerialActions } from "../hooks/use-serial-actions";
import { providerQueueDict } from "../lib/i18n";
import { NowServingCard } from "./NowServingCard";
import { WaitingRow } from "./WaitingRow";
import { EmptyLane } from "./EmptyLane";

interface Props {
  lane: Lane;
  lanes: Lane[];
  actions: ReturnType<typeof useSerialActions>;
}

export function ChairColumn({ lane, lanes, actions }: Props) {
  const { chair } = lane;
  const count = lane.waiting.length + (lane.inProgress ? 1 : 0);
  const t = useT(providerQueueDict);

  return (
    <section
      className={cn(
        "flex w-80 min-w-0 shrink-0 flex-col gap-3 md:w-auto md:shrink",
        lane.chairInactive && "opacity-60",
      )}
    >
      <header className="flex items-center gap-2 px-1">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: chair.color ?? "#94a3b8" }}
        />
        <p className="truncate text-sm font-bold text-ink">{chair.staff_name || chair.label}</p>
        <p className="flex shrink-0 items-center gap-1 truncate text-[11px] text-muted">
          {lane.chairInactive ? (
            <>
              <Pause className="h-3 w-3" />
              {t("chairClosed")}
            </>
          ) : (
            t("backlogMin", lane.backlogMin)
          )}
        </p>
        <span className="ml-auto grid h-5.5 min-w-5.5 shrink-0 place-items-center rounded-full bg-soft px-1.5 font-number text-xs font-bold text-ink">
          {count}
        </span>
      </header>

      {lane.inProgress && <NowServingCard serial={lane.inProgress} actions={actions} />}

      {lane.waiting.map((serial, index) => (
        <WaitingRow
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
