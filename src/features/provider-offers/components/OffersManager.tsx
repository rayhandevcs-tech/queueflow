"use client";

import { useState } from "react";
import { Percent, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { formatBanglaDate } from "@/lib/format-wait";
import { useOfferMutations, useOffers } from "../hooks/use-offers";
import { OfferForm } from "./OfferForm";

export function OffersManager({ shopId }: { shopId: string }) {
  const { data: offers, isPending } = useOffers(shopId);
  const { create, toggleActive } = useOfferMutations(shopId);
  const [creating, setCreating] = useState(false);
  const [now] = useState(() => Date.now());

  if (isPending) {
    return (
      <div className="grid min-h-32 place-items-center">
        <Spinner className="h-5 w-5 text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[27px] font-bold text-ink">অফার</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            অফার তৈরি করলে নিয়মিত কাস্টমারদের নোটিফিকেশন যাবে
          </p>
        </div>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
          >
            <Plus className="h-4 w-4" />
            নতুন অফার
          </button>
        )}
      </div>

      {creating && (
        <OfferForm
          busy={create.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={(values) => create.mutate(values, { onSuccess: () => setCreating(false) })}
        />
      )}

      {offers?.length === 0 ? (
        <EmptyState
          icon={<Percent className="h-6 w-6" />}
          title="এখনো কোনো অফার তৈরি হয়নি"
          description="প্রথম অফার তৈরি করো, নিয়মিত কাস্টমারদের কাছে পৌঁছে যাবে।"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {offers?.map((o) => {
            const expired = new Date(o.valid_until).getTime() < now;
            return (
              <div
                key={o.id}
                className="flex items-center gap-3.5 rounded-2xl border border-line bg-card p-4"
              >
                <div className="grid h-11.5 w-11.5 shrink-0 place-items-center rounded-[13px] bg-soft text-accent">
                  <Percent className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-[15px] font-semibold text-ink",
                      (!o.active || expired) && "text-muted line-through",
                    )}
                  >
                    {o.title}
                  </p>
                  <p className="text-xs text-muted">
                    {o.discount_pct}% ছাড় · মেয়াদ {formatBanglaDate(new Date(o.valid_until))}
                    {expired && " (শেষ)"}
                  </p>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleActive.mutate({ offerId: o.id, active: !o.active })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleActive.mutate({ offerId: o.id, active: !o.active });
                    }
                  }}
                  className="shrink-0 text-[11px] font-semibold"
                  style={{ color: o.active ? "var(--color-good)" : "var(--color-muted)" }}
                >
                  ● {o.active ? "চালু" : "বন্ধ"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
