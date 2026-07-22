"use client";

import { Plus } from "lucide-react";
import { formatBanglaDate } from "@/lib/format-wait";
import { Button } from "@/components/ui/Button";
import { LiveDot } from "@/components/ui/LiveDot";

interface Props {
  totals: { waiting: number; inProgress: number };
  onWalkIn: () => void;
}

export function BoardHeader({ totals, onWalkIn }: Props) {
  const waitingTotal = totals.waiting + totals.inProgress;

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">লাইভ সিরিয়াল</h1>
        <p className="mt-1 text-sm text-muted">
          আজ {formatBanglaDate(new Date())} · এখন{" "}
          <b className="font-number text-ink">{waitingTotal}</b> জন অপেক্ষায়
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 rounded-full bg-live-soft px-3.25 py-1.75 text-xs font-semibold text-live">
          <LiveDot />
          রিয়েল-টাইম আপডেট হচ্ছে
        </span>
        <Button onClick={onWalkIn}>
          <Plus className="h-4 w-4" />
          ওয়াক-ইন
        </Button>
      </div>
    </div>
  );
}
