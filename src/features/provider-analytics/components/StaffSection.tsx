"use client";

import { Armchair } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { providerAnalyticsDict } from "../lib/i18n";
import { AnalyticsSection, PercentText } from "./AnalyticsSection";
import { sortStaff, summarizeStaff, type StaffStatRow } from "../lib/compute-dashboard";

/**
 * Per-seat performance, with a utilization column that is allowed to say
 * "don't know".
 *
 * The denominator is the seat's own `staff_working_hours` roster, counted
 * across the weekdays that actually fall inside the window. A seat whose hours
 * were never configured has no denominator, so its utilization is N/A and the
 * cell says why — an invented one ("assume 10 hours a day") would produce a
 * percentage that looks authoritative and measures nothing.
 *
 * At 320px this is a stack of cards; from `sm` up it is a table. Same rows,
 * same numbers, nothing dropped — a horizontally scrolling table on a phone
 * hides the right-hand columns, which here would be the utilization the
 * section exists for.
 */
export function StaffSection({
  data,
  isPending,
  isError,
  onRetry,
}: {
  data: StaffStatRow[] | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const t = useT(providerAnalyticsDict);
  const rows = sortStaff(data ?? []);
  const summary = summarizeStaff(rows);
  const money = (n: number) => `৳${formatMoney(Math.round(n))}`;
  const hours = (min: number) => `${toBanglaDigits(Math.round(min / 60))}${t("hoursShort")}`;

  return (
    <AnalyticsSection
      title={t("sectionStaff")}
      subtitle={
        summary.utilizationPct === null
          ? undefined
          : t("staffPooled", toBanglaDigits(summary.utilizationPct))
      }
      icon={<Armchair className="h-4.5 w-4.5" />}
      note={t("staffUtilNote")}
      isPending={isPending}
      isError={isError}
      onRetry={onRetry}
      isEmpty={rows.length === 0}
      emptyText={t("staffNone")}
    >
      <div className="space-y-2.5">
        {/* phone: one card a seat */}
        <ul className="space-y-2.5 sm:hidden">
          {rows.map((row) => (
            <li key={row.staff_id}>
              <Card className="space-y-2 p-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
                    {row.staff_name || row.staff_label}
                  </p>
                  <p className="font-number shrink-0 text-[14px] font-bold text-ink">
                    {money(row.revenue_total)}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <Cell label={t("staffJobs")}>
                    {toBanglaDigits(row.jobs_total)}
                    {row.serial_jobs > 0 && row.appointment_jobs > 0 && (
                      <span className="text-muted">
                        {" "}
                        ({toBanglaDigits(row.serial_jobs)}+{toBanglaDigits(row.appointment_jobs)})
                      </span>
                    )}
                  </Cell>
                  <Cell label={t("staffMissed")}>
                    {toBanglaDigits(row.cancelled + row.no_show)}
                  </Cell>
                  <Cell label={t("staffBooked")}>{hours(row.booked_minutes)}</Cell>
                  <Cell label={t("staffRoster")}>
                    {row.working_minutes === null ? (
                      <span className="text-muted">{t("staffNoRoster")}</span>
                    ) : (
                      hours(row.working_minutes)
                    )}
                  </Cell>
                  <Cell label={t("staffUtilization")}>
                    <PercentText value={row.utilization_pct} />
                  </Cell>
                </dl>
              </Card>
            </li>
          ))}
        </ul>

        {/* tablet and up: a table */}
        <Card className="hidden overflow-hidden p-0 sm:block">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-soft text-[11px] text-muted">
                <th className="px-3 py-2.5 text-left font-semibold">{t("staffSeat")}</th>
                <th className="px-3 py-2.5 text-right font-semibold">{t("staffJobs")}</th>
                <th className="px-3 py-2.5 text-right font-semibold">{t("staffRevenue")}</th>
                <th className="px-3 py-2.5 text-right font-semibold">{t("staffMissed")}</th>
                <th className="px-3 py-2.5 text-right font-semibold">{t("staffBooked")}</th>
                <th className="px-3 py-2.5 text-right font-semibold">{t("staffRoster")}</th>
                <th className="px-3 py-2.5 text-right font-semibold">{t("staffUtilization")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.staff_id} className="border-b border-line/60 last:border-0">
                  <td className="max-w-40 truncate px-3 py-2.5 font-semibold text-ink">
                    {row.staff_name || row.staff_label}
                  </td>
                  <td className="font-number px-3 py-2.5 text-right text-ink">
                    {toBanglaDigits(row.jobs_total)}
                  </td>
                  <td className="font-number px-3 py-2.5 text-right font-semibold text-ink">
                    {money(row.revenue_total)}
                  </td>
                  <td className="font-number px-3 py-2.5 text-right text-muted">
                    {toBanglaDigits(row.cancelled + row.no_show)}
                  </td>
                  <td className="font-number px-3 py-2.5 text-right text-muted">
                    {hours(row.booked_minutes)}
                  </td>
                  <td className="font-number px-3 py-2.5 text-right text-muted">
                    {row.working_minutes === null ? (
                      <span className="text-[11px]">{t("staffNoRoster")}</span>
                    ) : (
                      hours(row.working_minutes)
                    )}
                  </td>
                  <td className="font-number px-3 py-2.5 text-right font-semibold text-ink">
                    <PercentText value={row.utilization_pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AnalyticsSection>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-number font-semibold text-ink">{children}</dd>
    </div>
  );
}
