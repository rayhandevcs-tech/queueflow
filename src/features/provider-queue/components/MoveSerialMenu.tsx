"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { keys } from "@/lib/query/keys";
import { getBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { ChairServiceStat, Serial } from "@/types";
import type { Lane } from "../lib/lanes";
import { providerQueueDict } from "../lib/i18n";

async function getStats(shopId: string): Promise<ChairServiceStat[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("chair_service_stats")
    .select("*, chairs!inner(shop_id)")
    .eq("chairs.shop_id", shopId);
  if (error) throw error;
  return data.map(({ chairs: _c, ...row }) => row as ChairServiceStat);
}

interface Props {
  serial: Serial;
  lanes: Lane[];
  moving: boolean;
  onMove: (targetChairId: string) => void;
}

export function MoveSerialMenu({ serial, lanes, moving, onMove }: Props) {
  const [open, setOpen] = useState(false);
  const t = useT(providerQueueDict);

  const { data: stats } = useQuery({
    queryKey: keys.chairStats.byShop(serial.shop_id),
    queryFn: () => getStats(serial.shop_id),
    enabled: open, // fetch lazily, first time the menu opens
  });

  const eligibleLanes = lanes.filter((lane) => {
    if (lane.chair.id === serial.chair_id) return false;
    if (!lane.chair.is_active) return false;
    if (!stats) return true; // stats loading → show all; DB re-checks anyway
    return serial.service_ids.every(
      (sid) =>
        stats.find(
          (r) => r.chair_id === lane.chair.id && r.service_id === sid,
        )?.can_perform ?? true,
    );
  });

  if (lanes.length < 2) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={moving}
        className="flex min-h-9 items-center gap-1 rounded-lg bg-soft px-3 text-sm font-semibold text-muted transition hover:bg-line disabled:opacity-50"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
        {moving ? t("movingCta") : t("moveCta")}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <>
          <button
            aria-label="close"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1.5 w-48 overflow-hidden rounded-xl border border-line bg-card shadow-lg">
            {eligibleLanes.length === 0 && (
              <p className="p-3 text-xs text-muted">{t("noEligibleChair")}</p>
            )}
            {eligibleLanes.map((lane) => (
              <button
                key={lane.chair.id}
                onClick={() => {
                  setOpen(false);
                  onMove(lane.chair.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-ink hover:bg-soft"
              >
                <span
                  className={cn("h-2.5 w-2.5 rounded-full")}
                  style={{ backgroundColor: lane.chair.color ?? "#cbd5e1" }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {lane.chair.staff_name || lane.chair.label}
                </span>
                <span className="text-xs text-muted">{t("backlogSuffixMin", lane.backlogMin)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
