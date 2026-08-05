"use client";

import { useState } from "react";
import { Plus, Receipt, Trash2 } from "lucide-react";
import type { ExpenseCategory } from "@/types";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { formatBanglaDate, formatMoney } from "@/lib/format-wait";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useExpenses } from "../hooks/use-expenses";
import { providerIncomeDict } from "../lib/i18n";

const CATEGORIES: ExpenseCategory[] = ["RENT", "UTILITY", "SUPPLIES", "STAFF", "OTHER"];

/** Today in the browser's own timezone, as the `YYYY-MM-DD` a date input wants. */
function todayValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The other half of the accounts.
 *
 * Income alone answers "how much came in", which is not the question an owner
 * is actually asking at the end of the month. Rent, electricity and supplies
 * are what turn that number into whether the shop made money.
 */
export function ExpensesView({ shopId }: { shopId: string | undefined }) {
  const { expenses, summary, isPending, add, remove } = useExpenses(shopId);
  const showToast = useToast();
  const t = useT(providerIncomeDict);

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>("SUPPLIES");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [spentOn, setSpentOn] = useState(todayValue);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
    RENT: t("categoryRent"),
    UTILITY: t("categoryUtility"),
    SUPPLIES: t("categorySupplies"),
    STAFF: t("categoryStaff"),
    OTHER: t("categoryOther"),
  };

  const reset = () => {
    setCategory("SUPPLIES");
    setAmount("");
    setNote("");
    setSpentOn(todayValue());
    setError(null);
  };

  const save = () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError(t("expenseAmountInvalid"));
      return;
    }
    add.mutate(
      { category, amount: value, note: note.trim() || null, spent_on: spentOn },
      {
        onSuccess: () => {
          showToast(t("expenseAddedToast"));
          reset();
          setOpen(false);
        },
        onError: () => showToast(t("expenseFailedToast")),
      },
    );
  };

  if (isPending) {
    return (
      <div className="grid min-h-[30vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[18px] border border-line bg-card p-4">
          <p className="text-[11px] text-muted">{t("expenseToday")}</p>
          <p className="mt-1 font-number text-2xl font-bold text-ink">
            ৳{formatMoney(summary.today)}
          </p>
        </div>
        <div className="rounded-[18px] border border-line bg-card p-4">
          <p className="text-[11px] text-muted">{t("expenseThisMonth")}</p>
          <p className="mt-1 font-number text-2xl font-bold text-live">
            ৳{formatMoney(summary.month)}
          </p>
        </div>
        <div className="rounded-[18px] border border-line bg-card p-4">
          <p className="text-[11px] text-muted">{t("expenseThisYear")}</p>
          <p className="mt-1 font-number text-2xl font-bold text-ink">
            ৳{formatMoney(summary.year)}
          </p>
        </div>
      </div>

      {summary.byCategory.length > 0 && (
        <div className="rounded-[18px] border border-line bg-card p-4">
          <p className="mb-2.5 text-xs font-semibold text-muted uppercase">
            {t("expenseByCategory")}
          </p>
          <ul className="space-y-2">
            {summary.byCategory.map((c) => (
              <li key={c.category} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink">{CATEGORY_LABEL[c.category]}</span>
                <span className="font-number font-semibold text-ink">
                  ৳{formatMoney(c.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {t("addExpenseCta")}
      </Button>

      {open && (
        <div className="space-y-3 rounded-[18px] border border-line bg-card p-4">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                  category === c
                    ? "border-accent bg-accent text-accent-ink"
                    : "border-line bg-card text-ink",
                )}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("expenseAmountLabel")} error={error ?? undefined}>
              <Input
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                inputMode="numeric"
                placeholder="0"
                invalid={!!error}
              />
            </Field>
            <Field label={t("expenseDateLabel")}>
              <Input
                type="date"
                value={spentOn}
                onChange={(e) => setSpentOn(e.target.value)}
                max={todayValue()}
              />
            </Field>
          </div>

          <Field label={t("expenseNoteLabel")}>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("expenseNotePlaceholder")}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              {t("expenseCancelCta")}
            </Button>
            <Button loading={add.isPending} onClick={save}>
              {t("expenseSaveCta")}
            </Button>
          </div>
        </div>
      )}

      {expenses.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title={t("noExpensesTitle")}
          description={t("noExpensesDesc")}
        />
      ) : (
        <ul className="space-y-2">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="flex items-center gap-3 rounded-[14px] border border-line bg-card px-3.5 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {CATEGORY_LABEL[e.category]}
                  {e.note && <span className="font-normal text-muted"> · {e.note}</span>}
                </p>
                <p className="text-[11px] text-muted">
                  {formatBanglaDate(new Date(`${e.spent_on}T00:00:00`))}
                </p>
              </div>
              <span className="shrink-0 font-number text-[15px] font-semibold text-live">
                ৳{formatMoney(e.amount)}
              </span>
              <button
                type="button"
                aria-label={t("deleteExpenseAria")}
                onClick={() => setDeleting(e.id)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:text-live"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmSheet
        open={!!deleting}
        title={t("deleteExpenseTitle")}
        description={t("deleteExpenseDesc")}
        confirmLabel={t("deleteExpenseConfirm")}
        cancelLabel={t("expenseCancelCta")}
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting, {
            onSuccess: () => {
              showToast(t("expenseDeletedToast"));
              setDeleting(null);
            },
            onError: () => showToast(t("expenseFailedToast")),
          });
        }}
      />
    </div>
  );
}
