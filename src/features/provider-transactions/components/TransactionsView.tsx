"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBanglaDate, formatMoney } from "@/lib/format-wait";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/lib/i18n";
import type { ExpenseCategory } from "@/types";
import {
  useExpenseTransactions,
  useManualTransactions,
  useSerialTransactions,
} from "../hooks/use-transactions";
import { providerTransactionsDict } from "../lib/i18n";
import {
  buildTransactions,
  groupByDay,
  totalsOf,
  type Transaction,
} from "../lib/build-transactions";

type Filter = "all" | "in" | "out";

/**
 * The shop's whole ledger on one timeline: every completed job, every manual
 * entry, every expense — newest first, grouped by day.
 *
 * Deliberately not the income page. That one aggregates into totals and trends;
 * this one names each transaction, because "who paid me and what did I spend
 * on" is a different question from "how did the month go".
 */
export function TransactionsView({ shopId }: { shopId: string }) {
  const t = useT(providerTransactionsDict);
  const [filter, setFilter] = useState<Filter>("all");

  const serials = useSerialTransactions(shopId);
  const manual = useManualTransactions(shopId);
  const expenses = useExpenseTransactions(shopId);

  const categoryLabel = (c: ExpenseCategory) =>
    t(`category${c}` as "categoryRENT" | "categoryUTILITY" | "categorySUPPLIES" | "categorySTAFF" | "categoryOTHER");

  const rows = useMemo(
    () =>
      buildTransactions(serials.data ?? [], manual.data ?? [], expenses.data ?? [], {
        walkInLabel: t("walkInCustomer"),
        manualLabel: t("manualEntry"),
        expenseLabel: categoryLabel,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t and categoryLabel are stable per language
    [serials.data, manual.data, expenses.data],
  );

  // Totals always describe the whole year, not the current filter: switching to
  // "expenses" should not make the shop look like it earned nothing.
  const totals = useMemo(() => totalsOf(rows), [rows]);

  const visible = useMemo(
    () =>
      rows.filter((r) =>
        filter === "all" ? true : filter === "in" ? r.amount >= 0 : r.amount < 0,
      ),
    [rows, filter],
  );
  const days = useMemo(() => groupByDay(visible), [visible]);

  if (serials.isPending || manual.isPending || expenses.isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">{t("pageTitle")}</h1>
        <p className="mt-1 text-[13px] text-muted">{t("pageSubtitle")}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <SummaryTile label={t("inflowLabel")} amount={totals.inflow} tone="good" />
        <SummaryTile label={t("outflowLabel")} amount={totals.outflow} tone="live" />
        <SummaryTile label={t("pendingLabel")} amount={totals.pending} tone="brass" />
        <SummaryTile label={t("netLabel")} amount={totals.net} tone="ink" />
      </div>

      <div className="flex gap-1.5 rounded-xl bg-soft p-1">
        {(["all", "in", "out"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors",
              filter === f ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {f === "all" ? t("filterAll") : f === "in" ? t("filterIn") : t("filterOut")}
          </button>
        ))}
      </div>

      {days.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title={t("emptyTitle")}
          description={t("emptyBody")}
          action={
            <Link href="/income" className="text-sm font-semibold text-accent hover:underline">
              {t("addExpenseCta")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {days.map((day) => (
            <section key={day.dayMs}>
              <h2 className="mb-1.5 px-1 text-[11px] font-bold tracking-wide text-muted uppercase">
                {dayLabel(day.dayMs, t("todayLabel"), t("yesterdayLabel"))}
              </h2>
              <ul className="overflow-hidden rounded-2xl border border-line bg-card">
                {day.rows.map((row) => (
                  <TransactionRow key={`${row.kind}-${row.id}`} row={row} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function dayLabel(dayMs: number, today: string, yesterday: string): string {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (dayMs === startOfToday) return today;
  if (dayMs === startOfToday - 86_400_000) return yesterday;
  return formatBanglaDate(new Date(dayMs));
}

function SummaryTile({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone: "good" | "live" | "brass" | "ink";
}) {
  const TONE = {
    good: "text-good",
    live: "text-live",
    brass: "text-brass",
    ink: "text-ink",
  } as const;

  return (
    <div className="rounded-2xl border border-line bg-card p-3.5">
      <p className="text-[11px] font-semibold text-muted">{label}</p>
      <p className={cn("mt-0.5 font-display text-xl font-bold", TONE[tone])}>
        ৳{formatMoney(Math.abs(amount))}
      </p>
    </div>
  );
}

function TransactionRow({ row }: { row: Transaction }) {
  const t = useT(providerTransactionsDict);
  const isOut = row.amount < 0;

  const methodLabel = row.method
    ? t(`method${row.method}` as "methodcash" | "methodbkash" | "methodnagad" | "methodrocket" | "methodcard")
    : null;

  return (
    <li className="flex items-center gap-3 border-b border-line p-3.5 last:border-0">
      {isOut ? (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-live-soft text-live">
          <ArrowUpRight className="h-5 w-5" />
        </span>
      ) : row.avatarUrl ? (
        <AvatarChip label={row.title} avatarUrl={row.avatarUrl} shape="circle" size={40} />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-good-soft text-good">
          <ArrowDownLeft className="h-5 w-5" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{row.title}</p>
        <p className="truncate text-[11px] text-muted">
          {[row.subtitle, methodLabel].filter(Boolean).join(" · ") || "—"}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={cn(
            "font-display text-[15px] font-bold",
            isOut ? "text-live" : row.unpaid ? "text-brass" : "text-good",
          )}
        >
          {isOut ? "−" : "+"}৳{formatMoney(Math.abs(row.amount))}
        </p>
        {row.unpaid && (
          <span className="text-[10px] font-semibold text-brass">{t("unpaidTag")}</span>
        )}
      </div>
    </li>
  );
}
