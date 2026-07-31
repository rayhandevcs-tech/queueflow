"use client";

import { Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { AvatarChip } from "@/components/ui/AvatarChip";
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
        "flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-soft/60 p-3",
        lane.chairInactive && "opacity-60",
      )}
    >
      <header className="flex items-center gap-2.5 px-1">
        <AvatarChip
          label={chair.staff_name || chair.label}
          avatarUrl={chair.staff_avatar_url}
          shape="circle"
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{chair.staff_name || chair.label}</p>
          <p className="flex items-center gap-1 truncate text-[11px] text-muted">
            {lane.chairInactive ? (
              <>
                <Pause className="h-3 w-3" />
                {t("chairClosed")}
              </>
            ) : (
              t("backlogMin", lane.backlogMin)
            )}
          </p>
        </div>
        <span className="grid h-5.5 min-w-5.5 shrink-0 place-items-center rounded-full bg-soft px-1.5 font-number text-xs font-bold text-ink">
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
