"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Store } from "lucide-react";
import type { Serial } from "@/types";
import { parseServicesSnapshot } from "@/types";
import { shopAvatarColor, shopInitial } from "@/lib/shop-avatar";
import { formatMoney } from "@/lib/format-wait";
import { groupByDay } from "@/lib/date-groups";
import { Spinner } from "@/components/ui/Spinner";
import { EmptyState } from "@/components/ui/EmptyState";
import { useProfileHistory } from "../hooks/use-profile-history";
import { EReceiptSheet } from "./EReceiptSheet";

export function TransactionsView() {
  const { history, shopsById, isPending } = useProfileHistory();
  const [receiptFor, setReceiptFor] = useState<Serial | null>(null);

  const done = history.filter((s) => s.status === "DONE");
  const groups = groupByDay(done, (s) => s.completed_at ?? s.created_at);

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center gap-2.5">
        <Link
          href="/profile"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-line bg-soft text-ink"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="font-display text-xl font-bold text-ink">লেনদেন</h1>
      </div>

      {isPending ? (
        <div className="grid min-h-[40vh] place-items-center">
          <Spinner className="h-6 w-6 text-muted" />
        </div>
      ) : done.length === 0 ? (
        <EmptyState
          icon={<Store className="h-6 w-6" />}
          title="এখনো কোনো লেনদেন নেই"
          description="সার্ভিস সম্পন্ন হলে এখানে খরচের হিসাব দেখতে পাবে।"
        />
      ) : (
        <div className="flex flex-col gap-4.5">
          {groups.map(([label, rows]) => (
            <div key={label}>
              <p className="mb-2 text-[12px] font-semibold tracking-wide text-muted uppercase">
                {label}
              </p>
              <div className="flex flex-col gap-2.25">
                {rows.map((s) => {
                  const shop = shopsById[s.shop_id];
                  const services = parseServicesSnapshot(s.services_snapshot);
                  return (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setReceiptFor(s)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setReceiptFor(s);
                      }}
                      className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-line bg-card p-3.25"
                    >
                      <div
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-display font-bold text-white"
                        style={{ background: shop ? shopAvatarColor(shop.id) : "var(--color-muted)" }}
                      >
                        {shop ? shopInitial(shop.name) : <Store className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-ink">
                          {shop?.name ?? "দোকান"}
                        </p>
                        <p className="truncate text-[11px] text-muted">
                          {services.map((sv) => sv.name).join(" + ") || "—"}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-number text-[13px] font-semibold text-ink">
                          ৳{formatMoney(s.total_amount)}
                        </p>
                        {s.payment_status === "DUE" && (
                          <p className="mt-0.5 rounded-full bg-live-soft px-2 py-0.5 text-[10px] font-semibold text-live">
                            বাকি ৳{formatMoney(s.due_amount)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {receiptFor && (
        <EReceiptSheet
          serial={receiptFor}
          shop={shopsById[receiptFor.shop_id]}
          onClose={() => setReceiptFor(null)}
        />
      )}
    </div>
  );
}
