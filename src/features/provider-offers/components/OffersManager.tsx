"use client";

import { useState } from "react";
import { Percent, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Offer } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { StatusPill } from "@/components/ui/StatusPill";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { formatBanglaDate } from "@/lib/format-wait";
import { useT } from "@/lib/i18n";
import { useOfferMutations, useOffers } from "../hooks/use-offers";
import { providerOffersDict } from "../lib/i18n";
import { OfferForm } from "./OfferForm";

export function OffersManager({ shopId }: { shopId: string }) {
  const { data: offers, isPending } = useOffers(shopId);
  const { create, update, remove, toggleActive } = useOfferMutations(shopId);
  const [editing, setEditing] = useState<Offer | "new" | null>(null);
  const [deleting, setDeleting] = useState<Offer | null>(null);
  const [now] = useState(() => Date.now());
  const t = useT(providerOffersDict);

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
          <h1 className="font-display text-[27px] font-bold text-ink">{t("offersTitle")}</h1>
          <p className="mt-0.5 text-[13px] text-muted">{t("offersSubtitle")}</p>
        </div>
        {editing === null && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
          >
            <Plus className="h-4 w-4" />
            {t("newOfferCta")}
          </button>
        )}
      </div>

      {editing !== null && (
        <OfferForm
          initial={editing === "new" ? undefined : editing}
          busy={create.isPending || update.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={(values) => {
            if (editing === "new") {
              create.mutate(values, { onSuccess: () => setEditing(null) });
            } else {
              update.mutate({ offerId: editing.id, values }, { onSuccess: () => setEditing(null) });
            }
          }}
        />
      )}

      {offers?.length === 0 ? (
        <EmptyState
          icon={<Percent className="h-6 w-6" />}
          title={t("noOffersTitle")}
          description={t("noOffersDesc")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {offers?.map((o) => {
            const expired = new Date(o.valid_until).getTime() < now;
            return (
              <div
                key={o.id}
                className="flex items-center gap-2 rounded-2xl border border-line bg-card p-4"
              >
                <button
                  type="button"
                  onClick={() => setEditing(o)}
                  className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
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
                      {t("discountOffValidUntil", o.discount_pct, formatBanglaDate(new Date(o.valid_until)))}
                      {expired && t("expiredSuffix")}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive.mutate({ offerId: o.id, active: !o.active })}
                  className="shrink-0"
                >
                  <StatusPill
                    tone={o.active ? "good" : "neutral"}
                    label={o.active ? t("offerActiveWord") : t("offerInactiveWord")}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(o)}
                  aria-label={t("deleteOfferAria")}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-live-soft hover:text-live"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmSheet
        open={deleting !== null}
        title={t("deleteOfferTitle")}
        description={t("deleteOfferDesc")}
        confirmLabel={t("deleteOfferConfirm")}
        loading={remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
