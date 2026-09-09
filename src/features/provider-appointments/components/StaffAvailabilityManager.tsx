"use client";

import { useState } from "react";
import { CalendarOff, Plus, Trash2, TriangleAlert } from "lucide-react";
import type { Chair, Shop } from "@/types";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { formatBanglaDate, formatBanglaTime } from "@/lib/format-wait";
import { parseWeeklyHours, DAY_LABEL_BN } from "@/lib/weekly-hours";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  useStaffDayMutation,
  useStaffHours,
  useTimeOff,
  useTimeOffMutations,
} from "../hooks/use-staff-availability";
import {
  ISO_WEEKDAYS,
  dayKeyOfIso,
  effectiveWindow,
  hoursByWeekday,
  isClippedByShop,
  isFullDay,
} from "../lib/staff-hours";
import { providerAppointmentsDict } from "../lib/i18n";

/**
 * Each beautician's own week, and their leave.
 *
 * Before this screen a shop's opening hours were every staff member's hours,
 * which is wrong the moment one of them works mornings only. A missing day
 * here means "does not work" — the same thing it means in the database
 * (decision 46), so what the owner sees and what the booking engine enforces
 * are one fact, not two.
 */
export function StaffAvailabilityManager({ shop, chairs }: { shop: Shop; chairs: Chair[] }) {
  const t = useT(providerAppointmentsDict);
  const chairIds = chairs.map((c) => c.id);
  const { data: hours, isPending } = useStaffHours(chairIds);
  const { data: timeOff } = useTimeOff(chairIds);
  const shopHours = parseWeeklyHours(shop.weekly_hours);

  if (chairs.length === 0) return null;
  if (isPending) {
    return (
      <div className="grid min-h-24 place-items-center">
        <Spinner className="h-5 w-5 text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">{t("availabilityHeading")}</h2>
        <p className="mt-0.5 text-[13px] text-muted">{t("availabilityDesc")}</p>
      </div>

      {chairs.map((chair) => (
        <StaffCard
          key={chair.id}
          chair={chair}
          shopHours={shopHours}
          rows={hours ?? []}
          leave={(timeOff ?? []).filter((l) => l.chair_id === chair.id)}
        />
      ))}
    </div>
  );
}

function StaffCard({
  chair,
  shopHours,
  rows,
  leave,
}: {
  chair: Chair;
  shopHours: ReturnType<typeof parseWeeklyHours>;
  rows: Parameters<typeof hoursByWeekday>[0];
  leave: { id: string; starts_at: string; ends_at: string; reason: string | null }[];
}) {
  const t = useT(providerAppointmentsDict);
  const setDay = useStaffDayMutation();
  const { add, remove } = useTimeOffMutations();
  const [adding, setAdding] = useState(false);
  const byDay = hoursByWeekday(rows, chair.id);

  return (
    <Card className="p-4">
      <header className="mb-3 flex items-center gap-2.5">
        <AvatarChip
          label={chair.staff_name || chair.label}
          avatarUrl={chair.staff_avatar_url}
          shape="circle"
          size={32}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{chair.staff_name || chair.label}</p>
          <p className="truncate text-[11px] text-muted">{chair.label}</p>
        </div>
      </header>

      <ul className="space-y-1.5">
        {ISO_WEEKDAYS.map((weekday) => {
          const row = byDay.get(weekday);
          const window = effectiveWindow(shopHours, row, weekday);
          const clipped = isClippedByShop(shopHours, row, weekday);
          return (
            <li key={weekday} className="flex flex-wrap items-center gap-2">
              <span className="w-20 shrink-0 text-[12px] font-semibold text-ink">
                {DAY_LABEL_BN[dayKeyOfIso(weekday)]}
              </span>

              {row ? (
                <>
                  <TimeBox
                    value={row.start_time.slice(0, 5)}
                    onCommit={(next) =>
                      setDay.mutate({
                        chairId: chair.id,
                        weekday,
                        hours: { start: next, end: row.end_time.slice(0, 5) },
                      })
                    }
                  />
                  <span className="text-muted">–</span>
                  <TimeBox
                    value={row.end_time.slice(0, 5)}
                    onCommit={(next) =>
                      setDay.mutate({
                        chairId: chair.id,
                        weekday,
                        hours: { start: row.start_time.slice(0, 5), end: next },
                      })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setDay.mutate({ chairId: chair.id, weekday, hours: null })}
                    className="text-[11px] font-semibold text-muted hover:text-live"
                  >
                    {t("availabilityDayOff")}
                  </button>
                  {/* The shop's own hours always win, so say so rather than
                      letting the owner wonder why a time never appears. */}
                  {!window && (
                    <Badge variant="brass" className="gap-1">
                      <TriangleAlert className="h-3 w-3" />
                      {t("availabilityShopShut")}
                    </Badge>
                  )}
                  {window && clipped && (
                    <Badge variant="neutral">{t("availabilityClipped")}</Badge>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setDay.mutate({
                      chairId: chair.id,
                      weekday,
                      hours: { start: "10:00", end: "20:00" },
                    })
                  }
                  className="text-[12px] font-semibold text-accent hover:underline"
                >
                  {t("availabilitySetDay")}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 border-t border-line pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold text-muted">{t("leaveHeading")}</p>
          <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
            <Plus className="h-3.5 w-3.5" />
            {t("leaveAdd")}
          </Button>
        </div>

        {adding && (
          <LeaveForm
            busy={add.isPending}
            onCancel={() => setAdding(false)}
            onSubmit={(range) =>
              add.mutate(
                { chairId: chair.id, ...range },
                { onSuccess: () => setAdding(false) },
              )
            }
          />
        )}

        {leave.length === 0 ? (
          <p className="mt-2 text-[12px] text-muted">{t("leaveNone")}</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {leave.map((period) => (
              <li
                key={period.id}
                className="flex items-center gap-2 rounded-xl bg-soft px-2.5 py-1.5"
              >
                <CalendarOff className="h-3.5 w-3.5 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink">
                  {isFullDay(period)
                    ? t("leaveFullDay", formatBanglaDate(new Date(period.starts_at)))
                    : t(
                        "leaveRange",
                        formatBanglaDate(new Date(period.starts_at)),
                        formatBanglaTime(new Date(period.starts_at)),
                        formatBanglaTime(new Date(period.ends_at)),
                      )}
                  {period.reason ? ` · ${period.reason}` : ""}
                </span>
                <button
                  type="button"
                  aria-label={t("leaveRemove")}
                  onClick={() => remove.mutate(period.id)}
                  className="shrink-0 text-muted hover:text-live"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/** Commits on blur, not on every keystroke — one write per edit, not per digit. */
function TimeBox({ value, onCommit }: { value: string; onCommit: (next: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      type="time"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft && draft !== value) onCommit(draft);
        else setDraft(value);
      }}
      className="w-28 min-h-9 px-2 text-[13px]"
    />
  );
}

function LeaveForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (range: { startsAt: string; endsAt: string; reason: string | null }) => void;
  onCancel: () => void;
}) {
  const t = useT(providerAppointmentsDict);
  const [date, setDate] = useState("");
  const [fullDay, setFullDay] = useState(true);
  const [from, setFrom] = useState("10:00");
  const [to, setTo] = useState("14:00");
  const [reason, setReason] = useState("");

  // Built in the browser's own zone, which is the shop's — the same
  // assumption `shop_timezone()` makes on the server (decision 48).
  const submit = () => {
    if (!date) return;
    const [y, m, d] = date.split("-").map(Number);
    const start = fullDay ? new Date(y, m - 1, d) : atTime(y, m, d, from);
    const end = fullDay ? new Date(y, m - 1, d + 1) : atTime(y, m, d, to);
    if (end <= start) return;
    onSubmit({
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      reason: reason.trim() || null,
    });
  };

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-line bg-soft p-3">
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFullDay(true)}
          aria-pressed={fullDay}
          className={cn(
            "min-h-9 rounded-full border px-3 text-[12px] font-semibold",
            fullDay ? "border-accent bg-accent text-accent-ink" : "border-line bg-card text-muted",
          )}
        >
          {t("leaveWholeDay")}
        </button>
        <button
          type="button"
          onClick={() => setFullDay(false)}
          aria-pressed={!fullDay}
          className={cn(
            "min-h-9 rounded-full border px-3 text-[12px] font-semibold",
            !fullDay ? "border-accent bg-accent text-accent-ink" : "border-line bg-card text-muted",
          )}
        >
          {t("leavePartDay")}
        </button>
        {!fullDay && (
          <>
            <Input
              type="time"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-28 min-h-9 px-2 text-[13px]"
            />
            <span className="text-muted">–</span>
            <Input
              type="time"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-28 min-h-9 px-2 text-[13px]"
            />
          </>
        )}
      </div>
      <Input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("leaveReasonPlaceholder")}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit} loading={busy} disabled={!date}>
          {t("leaveSave")}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          {t("leaveCancel")}
        </Button>
      </div>
    </div>
  );
}

function atTime(y: number, m: number, d: number, hm: string): Date {
  const [h, min] = hm.split(":").map(Number);
  return new Date(y, m - 1, d, h || 0, min || 0);
}

/** No staff at all → the schedule screen has nothing to say. */
export function StaffAvailabilityEmpty({ label }: { label: string }) {
  return <EmptyState icon={<CalendarOff className="h-6 w-6" />} title={label} dashed />;
}
