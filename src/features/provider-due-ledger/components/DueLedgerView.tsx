"use client";

import { useState } from "react";
import { Bell, Check, Wallet } from "lucide-react";
import { formatBanglaDate, formatMoney } from "@/lib/format-wait";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { useDueLedger } from "../hooks/use-due-ledger";

export function DueLedgerView({ shopId }: { shopId: string | undefined }) {
  const { groups, totalDue, isPending, collect, remind } = useDueLedger(shopId);
  const showToast = useToast();
  const [justReminded, setJustReminded] = useState<Set<string>>(new Set());

  if (isPending) {
    return (
      <div className="grid min-h-[40vh] place-items-center">
        <Spinner className="h-6 w-6 text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[27px] font-bold text-ink">বাকির খাতা</h1>
        <p className="mt-1 text-[13px] text-muted">
          {groups.length === 0
            ? "এখন কারো কাছে কোনো বাকি নেই"
            : `মোট বাকি ৳${formatMoney(totalDue)} · ${groups.length} জন কাস্টমার`}
        </p>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" />}
          title="বাকির খাতা খালি"
          description={'"বাকি রেখে সম্পন্ন করো" দিয়ে কাজ শেষ করলে সেই কাস্টমার এখানে দেখাবে।'}
        />
      ) : (
        <div className="flex flex-col gap-2.75">
          {groups.map((g) => {
            const reminded = justReminded.has(g.key);
            const canRemind = g.remindableSerialIds.length > 0 && !reminded;
            return (
              <div
                key={g.key}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-card p-4"
              >
                <div
                  className="grid h-11.5 w-11.5 shrink-0 place-items-center rounded-[14px] font-display text-lg font-bold text-white"
                  style={{ background: shopAvatarColor(g.key) }}
                >
                  {shopInitial(g.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-base font-bold text-ink">{g.name}</p>
                  <p className="text-xs text-muted">
                    {g.oldestDueAt ? `সেই থেকে বাকি ${formatBanglaDate(new Date(g.oldestDueAt))}` : "—"}
                    {g.serialIds.length > 1 ? ` · ${g.serialIds.length} বার` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-live-soft px-3 py-1 font-number text-sm font-bold text-live">
                  ৳{formatMoney(g.totalDue)}
                </span>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!canRemind || remind.isPending}
                    title={reminded ? "আজ পাঠানো হয়ে গেছে" : "রিমাইন্ডার দাও"}
                    onClick={() => {
                      remind.mutate(g.remindableSerialIds, {
                        onSuccess: () => {
                          setJustReminded((prev) => new Set(prev).add(g.key));
                          showToast("🔔 রিমাইন্ডার পাঠানো হয়েছে");
                        },
                        onError: (err) =>
                          showToast(
                            err instanceof Error && err.message
                              ? err.message
                              : "রিমাইন্ডার পাঠানো যায়নি — আবার চেষ্টা করো",
                          ),
                      });
                    }}
                    className="grid h-9 w-9 place-items-center rounded-xl border border-line text-muted disabled:opacity-40"
                  >
                    <Bell className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={collect.isPending}
                    onClick={() => {
                      collect.mutate(g.serialIds, {
                        onSuccess: () => showToast("✓ আদায় হয়েছে হিসেবে মার্ক করা হয়েছে"),
                        onError: () => showToast("মার্ক করা যায়নি — আবার চেষ্টা করো"),
                      });
                    }}
                    className="flex h-9 items-center gap-1.5 rounded-xl bg-good px-3.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    আদায় হয়েছে
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
