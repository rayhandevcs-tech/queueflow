"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarSearch, X } from "lucide-react";
import type { Chair } from "@/types";
import { cn } from "@/lib/utils";
import { keys } from "@/lib/query/keys";
import { useT } from "@/lib/i18n";
import { formatBanglaDate, formatBanglaTime, formatMoney, toBanglaDigits } from "@/lib/format-wait";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { StatusPill } from "@/components/ui/StatusPill";
import { LIST_LIMIT } from "../api/appointments.api";
import { getChairsForSummary } from "../api/parlour-summary.api";
import { useAppointmentList } from "../hooks/use-appointment-list";
import { providerAppointmentsDict } from "../lib/i18n";
import { EMPTY_FILTERS, LIST_SCOPES, hasActiveFilters, type ListFilters, type ListScope } from "../lib/list-query";
import { STATUS_LABEL_KEY, statusStyle } from "../lib/status";
import type { AppointmentListRow } from "../lib/types";

const SCOPE_LABEL_KEY = {
  today: "listScopeToday",
  upcoming: "listScopeUpcoming",
  completed: "listScopeCompleted",
  cancelled: "listScopeCancelled",
  all: "listScopeAll",
} as const satisfies Record<ListScope, string>;

/**
 * Every appointment the shop has, as a record rather than a calendar.
 *
 * The board answers "what is happening right now"; this answers "what
 * happened", "what is coming" and "was I paid for it" — questions a grid of
 * time blocks is the wrong shape for. Hence a table: one row per booking,
 * with the columns an owner would read off a paper register.
 *
 * The money columns are read straight from the appointment row, not joined
 * from anywhere: `total_amount` is the price frozen at booking time and
 * `payment_status` is what the completion sheet recorded, so a service
 * repriced next month leaves every row here exactly as it was.
 */
export function AppointmentListView({ shopId }: { shopId: string }) {
  const t = useT(providerAppointmentsDict);
  const [filters, setFilters] = useState<ListFilters>(EMPTY_FILTERS);

  const { data: chairs } = useQuery({
    queryKey: keys.chairs.byShop(shopId),
    queryFn: () => getChairsForSummary(shopId),
  });
  const { data: rows, isPending, isError } = useAppointmentList(shopId, filters);

  // Name per staff id, resolved once. The rows carry only `staff_id` — the
  // board's own seam — so the list looks the name up rather than the query
  // joining `chairs` and duplicating a name into every row.
  const staffName = useMemo(() => {
    const map = new Map<string, Chair>();
    for (const chair of chairs ?? []) map.set(chair.id, chair);
    return (id: string) => {
      const chair = map.get(id);
      return chair ? chair.staff_name || chair.label : "—";
    };
  }, [chairs]);

  const patch = (next: Partial<ListFilters>) => setFilters((f) => ({ ...f, ...next }));

  const columns: DataTableColumn<AppointmentListRow>[] = [
    {
      id: "customer",
      header: t("listColCustomer"),
      cell: (row) => (
        <div className="flex items-center gap-2">
          <AvatarChip
            label={row.customerName}
            avatarUrl={row.customerAvatarUrl}
            shape="circle"
            size={26}
          />
          <span className="font-semibold text-ink">
            {row.customerName || t("noCustomerName")}
          </span>
        </div>
      ),
    },
    {
      id: "services",
      header: t("listColServices"),
      cell: (row) => (
        <span className="text-muted">{row.serviceNames.join(", ") || "—"}</span>
      ),
    },
    {
      id: "staff",
      header: t("listColStaff"),
      cell: (row) => <span className="text-muted">{staffName(row.staffId)}</span>,
    },
    {
      id: "date",
      header: t("listColDate"),
      cell: (row) => (
        <span className="whitespace-nowrap text-muted">
          {formatBanglaDate(new Date(row.startsAt))}
        </span>
      ),
    },
    {
      id: "start",
      header: t("listColStart"),
      cell: (row) => (
        <span className="whitespace-nowrap font-number text-ink">
          {formatBanglaTime(new Date(row.startsAt))}
        </span>
      ),
    },
    {
      id: "end",
      header: t("listColEnd"),
      cell: (row) => (
        <span className="whitespace-nowrap font-number text-muted">
          {formatBanglaTime(new Date(row.endsAt))}
        </span>
      ),
    },
    {
      id: "price",
      header: t("listColPrice"),
      className: "text-right",
      cell: (row) => <PriceCell row={row} />,
    },
    {
      id: "status",
      header: t("listColStatus"),
      cell: (row) => <StatusCell row={row} />,
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">{t("listTitle")}</h1>
        <p className="mt-1 text-[13px] text-muted">{t("listSubtitle")}</p>
      </div>

      {/* --- scopes: the four questions, plus everything --- */}
      <div
        role="tablist"
        aria-label={t("listTitle")}
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5"
      >
        {LIST_SCOPES.map((scope) => (
          <button
            key={scope}
            type="button"
            role="tab"
            aria-selected={filters.scope === scope}
            onClick={() => patch({ scope })}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors",
              filters.scope === scope
                ? "border-accent bg-accent text-accent-ink"
                : "border-line bg-card text-muted hover:text-ink",
            )}
          >
            {t(SCOPE_LABEL_KEY[scope])}
          </button>
        ))}
      </div>

      {/* --- person and date range --- */}
      <div className="grid gap-2.5 sm:grid-cols-[1fr_auto_auto_auto]">
        <select
          value={filters.staffId ?? ""}
          onChange={(e) => patch({ staffId: e.target.value || null })}
          aria-label={t("listColStaff")}
          className="h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
        >
          <option value="">{t("listAllStaff")}</option>
          {(chairs ?? []).map((chair) => (
            <option key={chair.id} value={chair.id}>
              {chair.staff_name || chair.label}
            </option>
          ))}
        </select>

        <DayField
          label={t("listFrom")}
          value={filters.from}
          onChange={(from) => patch({ from })}
        />
        <DayField label={t("listTo")} value={filters.to} onChange={(to) => patch({ to })} />

        <button
          type="button"
          onClick={() => setFilters(EMPTY_FILTERS)}
          disabled={!hasActiveFilters(filters)}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-card px-3.5 text-[13px] font-semibold text-muted transition-colors hover:text-ink disabled:opacity-40"
        >
          <X className="h-4 w-4" />
          {t("listClearFilters")}
        </button>
      </div>

      {isError ? (
        <p className="py-10 text-center text-sm text-live">{t("listLoadFailed")}</p>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={rows ?? []}
            rowKey={(row) => row.id}
            loading={isPending}
            emptyIcon={<CalendarSearch className="h-6 w-6" />}
            emptyTitle={t("listEmptyTitle")}
            emptyDescription={t("listEmptyBody")}
            mobileCard={(row) => (
              <div className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <AvatarChip
                    label={row.customerName}
                    avatarUrl={row.customerAvatarUrl}
                    shape="circle"
                    size={34}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {row.customerName || t("noCustomerName")}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {row.serviceNames.join(", ") || "—"}
                    </p>
                  </div>
                  <StatusCell row={row} />
                </div>
                <div className="flex items-end justify-between gap-2 border-t border-line pt-2">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold text-ink">
                      {formatBanglaDate(new Date(row.startsAt))}
                    </p>
                    <p className="truncate font-number text-[11px] text-muted">
                      {formatBanglaTime(new Date(row.startsAt))} –{" "}
                      {formatBanglaTime(new Date(row.endsAt))} · {staffName(row.staffId)}
                    </p>
                  </div>
                  <PriceCell row={row} />
                </div>
              </div>
            )}
          />

          {/* Said only when the cap was actually reached, so it reads as a
              fact about this list rather than a permanent warning. */}
          {(rows?.length ?? 0) >= LIST_LIMIT && (
            <p className="text-center text-[11px] text-muted">
              {t("listCapped", toBanglaDigits(rows?.length ?? 0))}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The price, and whether it actually came in.
 *
 * One cell rather than two columns: "৳800" and "unpaid" are one fact to an
 * owner, and the brief's eight columns already fill a laptop's width.
 */
function PriceCell({ row }: { row: AppointmentListRow }) {
  const t = useT(providerAppointmentsDict);
  const unpaid = row.paymentStatus === "DUE" && row.status === "DONE";

  return (
    <div className="text-right">
      <p className="font-display text-[15px] font-bold whitespace-nowrap text-ink">
        ৳{formatMoney(row.totalAmount)}
      </p>
      {row.status === "DONE" && (
        <span
          className={cn("text-[10px] font-semibold", unpaid ? "text-brass" : "text-good")}
          // The amount owed is the number that matters when it is owed.
          title={unpaid ? `৳${formatMoney(row.dueAmount)}` : undefined}
        >
          {unpaid ? t("listUnpaidTag") : t("listPaidTag")}
        </span>
      )}
    </div>
  );
}

function StatusCell({ row }: { row: AppointmentListRow }) {
  const t = useT(providerAppointmentsDict);
  const style = statusStyle(row.status);
  return (
    <StatusPill
      tone={style.tone}
      pulse={style.pulse}
      dot={style.pulse}
      label={t(STATUS_LABEL_KEY[row.status])}
      className="shrink-0"
    />
  );
}

/**
 * One end of the date range.
 *
 * A native date input on purpose: it is the one control every phone already
 * renders in the owner's own locale and calendar, and a hand-built picker
 * here would be a Bangla calendar to maintain for two fields.
 */
function DayField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-xl border border-line bg-card px-3">
      <span className="shrink-0 text-[11px] font-semibold text-muted">{label}</span>
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="min-w-0 flex-1 bg-transparent font-number text-[13px] text-ink outline-none"
      />
    </label>
  );
}
