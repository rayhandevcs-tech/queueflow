"use client";

import { DAY_LABEL_BN, DAY_ORDER, formatDayHours, parseWeeklyHours } from "@/lib/weekly-hours";
import type { Shop } from "@/types";

export function DetailsTab({ shop }: { shop: Shop }) {
  const hours = parseWeeklyHours(shop.weekly_hours);

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
          দোকান সম্পর্কে
        </p>
        <p className="text-sm leading-relaxed text-ink">
          {shop.about?.trim() || "কোনো বিবরণ যোগ করা হয়নি।"}
        </p>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold tracking-wide text-muted uppercase">
          সাপ্তাহিক সময়সূচি
        </p>
        {!hours ? (
          <p className="text-sm text-muted">সময়সূচি এখনো যোগ করা হয়নি।</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line">
            {DAY_ORDER.map((day, i) => (
              <div
                key={day}
                className={`flex items-center justify-between px-4 py-2.5 text-sm ${
                  i % 2 === 0 ? "bg-card" : "bg-soft"
                }`}
              >
                <span className="font-medium text-ink">{DAY_LABEL_BN[day]}</span>
                <span className="text-muted">{formatDayHours(hours[day])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
