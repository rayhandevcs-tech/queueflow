"use client";

import { dayLabel, DAY_ORDER, formatDayHours, parseWeeklyHours } from "@/lib/weekly-hours";
import type { Shop } from "@/types";
import { useT } from "@/lib/i18n";
import { customerBookingDict } from "../lib/i18n";

export function DetailsTab({ shop }: { shop: Shop }) {
  const hours = parseWeeklyHours(shop.weekly_hours);
  const t = useT(customerBookingDict);

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
          {t("aboutShopHeading")}
        </p>
        <p className="text-sm leading-relaxed text-ink">
          {shop.about?.trim() || t("noAboutAdded")}
        </p>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
          {t("weeklyHoursHeading")}
        </p>
        {!hours ? (
          <p className="text-sm text-muted">{t("noHoursAdded")}</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line">
            {DAY_ORDER.map((day, i) => (
              <div
                key={day}
                className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                  i % 2 === 0 ? "bg-card" : "bg-soft"
                }`}
              >
                <span className="font-medium text-ink">{dayLabel(day)}</span>
                <span className="text-muted">{formatDayHours(hours[day])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
