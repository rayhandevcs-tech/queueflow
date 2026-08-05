"use client";

import { Card } from "@/components/ui/Card";
import { formatBanglaDate, toBanglaDigits } from "@/lib/format-wait";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { adminDict } from "../lib/i18n";

interface Props {
  daily: Array<{ day: string; serials: number; signups: number }>;
}

/**
 * Deliberately CSS bars, not a charting library — the stack rule says no heavy
 * new dependencies, and a 14-column bar pair doesn't need one.
 */
export function TrendChart({ daily }: Props) {
  const t = useT(adminDict);
  const max = Math.max(1, ...daily.map((d) => Math.max(d.serials, d.signups)));

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-ink">{t("trend14dTitle")}</h2>
        <div className="flex items-center gap-3 text-[11px] font-medium text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            {t("trendSerials")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-good" />
            {t("trendSignups")}
          </span>
        </div>
      </div>

      {daily.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">{t("trendEmpty")}</p>
      ) : (
        <div className="mt-4 flex items-end gap-1.5 overflow-x-auto pb-1">
          {daily.map((d) => {
            const date = new Date(`${d.day}T00:00:00`);
            return (
              <div key={d.day} className="flex min-w-8 flex-1 flex-col items-center gap-1.5">
                <div className="flex h-28 w-full items-end justify-center gap-0.5">
                  <Bar value={d.serials} max={max} className="bg-accent" />
                  <Bar value={d.signups} max={max} className="bg-good" />
                </div>
                <span className="text-[10px] whitespace-nowrap text-muted">
                  {formatBanglaDate(date)}
                </span>
                <span className="font-number text-[10px] font-semibold text-ink">
                  {toBanglaDigits(d.serials)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  // Always leave 2px so a zero-day still reads as a day, not a gap.
  const height = value === 0 ? 2 : Math.max(4, Math.round((value / max) * 112));
  return (
    <span
      className={cn("w-2 rounded-t-sm", value === 0 ? "bg-line" : className)}
      style={{ height }}
      aria-hidden
    />
  );
}
