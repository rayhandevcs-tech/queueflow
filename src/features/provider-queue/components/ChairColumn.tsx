"use client";

import { Clock3, Pause } from "lucide-react";
import type { Serial } from "@/types";
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
  /** Every row on the board — party badges have to look across lanes. */
  boardRows: Serial[];
  actions: ReturnType<typeof useSerialActions>;
}

export function ChairColumn({ lane, lanes, boardRows, actions }: Props) {
  const { chair } = lane;
  const count = lane.waiting.length + (lane.inProgress ? 1 : 0);
  const t = useT(providerQueueDict);

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-card p-3 shadow-sm",
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
          {/* A pill rather than a line of grey text: it is the one number an
              owner scans this header for, and "~12 মিন অপেক্ষা" read as a
              caption on the staff name instead of a figure of its own. */}
          {lane.chairInactive ? (
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-soft px-2 py-0.5 text-[11px] font-semibold text-muted">
              <Pause className="h-2.5 w-2.5" />
              {t("chairClosed")}
            </span>
          ) : lane.backlogMin > 0 ? (
            <span
              title={t("waitLabelAria")}
              className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-live-soft px-2 py-0.5 text-[11px] font-semibold text-live"
            >
              <Clock3 className="h-2.5 w-2.5" />
              {t("backlogMin", lane.backlogMin)}
            </span>
          ) : (
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-0.5 text-[11px] font-semibold text-good">
              {t("backlogFree")}
            </span>
          )}
        </div>
        <span className="grid h-5.5 min-w-5.5 shrink-0 place-items-center rounded-full bg-soft px-1.5 font-number text-xs font-bold text-ink">
          {count}
        </span>
      </header>

      {lane.inProgress && (
        <NowServingCard serial={lane.inProgress} boardRows={boardRows} actions={actions} />
      )}

      {lane.waiting.map((serial, index) => (
        <WaitingRow
          key={serial.id}
          serial={serial}
          canStart={lane.canStart && index === 0}
          lanes={lanes}
          boardRows={boardRows}
          actions={actions}
        />
      ))}

      {!lane.inProgress && lane.waiting.length === 0 && <EmptyLane />}
    </section>
  );
}
