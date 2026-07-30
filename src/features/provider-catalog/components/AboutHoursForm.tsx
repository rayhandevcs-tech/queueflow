"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  dayLabel,
  DAY_ORDER,
  emptyWeeklyHours,
  parseWeeklyHours,
  type DayKey,
  type WeeklyHours,
} from "@/lib/weekly-hours";
import type { Json, Shop } from "@/types";
import { useT } from "@/lib/i18n";
import { useShopMutations } from "../hooks/use-my-shop";
import { providerCatalogDict } from "../lib/i18n";

export function AboutHoursForm({ shop }: { shop: Shop }) {
  const { update } = useShopMutations();
  const [about, setAbout] = useState(shop.about ?? "");
  const [hours, setHours] = useState<WeeklyHours>(
    () => parseWeeklyHours(shop.weekly_hours) ?? emptyWeeklyHours(),
  );
  const t = useT(providerCatalogDict);

  const setDay = (day: DayKey, patch: Partial<WeeklyHours[DayKey]>) => {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  };

  const onSave = () => {
    update.mutate({
      shopId: shop.id,
      patch: { about: about.trim() || null, weekly_hours: hours as unknown as Json },
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-ink">{t("aboutLabel")}</label>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          rows={3}
          placeholder={t("aboutPlaceholder")}
          className="w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-sm text-ink shadow-xs placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-ink">{t("weeklyHoursLabel")}</label>
        <div className="space-y-2">
          {DAY_ORDER.map((day) => {
            const d = hours[day];
            return (
              <div key={day} className="flex items-center gap-2 rounded-xl bg-soft p-2.5">
                <span className="w-20 shrink-0 text-xs font-medium text-ink">
                  {dayLabel(day)}
                </span>
                {d.closed ? (
                  <span className="flex-1 text-xs text-muted">{t("dayClosedStatus")}</span>
                ) : (
                  <div className="flex flex-1 items-center gap-1.5">
                    <input
                      type="time"
                      value={d.open ?? ""}
                      onChange={(e) => setDay(day, { open: e.target.value })}
                      className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2 py-1 text-xs text-ink"
                    />
                    <span className="text-xs text-muted">–</span>
                    <input
                      type="time"
                      value={d.close ?? ""}
                      onChange={(e) => setDay(day, { close: e.target.value })}
                      className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2 py-1 text-xs text-ink"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setDay(day, { closed: !d.closed })}
                  className="shrink-0 rounded-full bg-card px-2.5 py-1 text-[11px] font-semibold text-muted shadow-xs"
                >
                  {d.closed ? t("dayToggleOpen") : t("dayToggleClose")}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <Button onClick={onSave} loading={update.isPending}>
        {update.isPending ? t("hoursSaving") : t("hoursSave")}
      </Button>
    </div>
  );
}
