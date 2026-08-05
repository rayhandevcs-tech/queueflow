"use client";

import { useState } from "react";
import { NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { formatBanglaDate, formatBanglaTime, formatMoney } from "@/lib/format-wait";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { StatusPill } from "@/components/ui/StatusPill";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import type { ManualEntry } from "@/types";
import { useT } from "@/lib/i18n";
import {
  useManualEntryList,
  useManualEntryMutations,
  useManualEntryPickers,
} from "../hooks/use-manual-entries";
import { providerIncomeDict } from "../lib/i18n";
import { ManualEntryForm } from "./ManualEntryForm";

export function ManualEntrySection({ shopId }: { shopId: string }) {
  const { entries, isPending } = useManualEntryList(shopId);
  const { services, chairs } = useManualEntryPickers(shopId);
  const { create, update, remove } = useManualEntryMutations(shopId);
  const [editing, setEditing] = useState<ManualEntry | "new" | null>(null);
  const [deleting, setDeleting] = useState<ManualEntry | null>(null);
  const t = useT(providerIncomeDict);

  const serviceName = (id: string) =>
    services.find((s) => s.id === id)?.name ?? t("manualEntryUnknownService");
  const staffName = (id: string | null) =>
    (id ? chairs.find((c) => c.id === id)?.staff_name : null) || null;

  return (
    <div className="rounded-[20px] border border-line bg-card p-5.5">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{t("manualEntrySectionTitle")}</p>
          <p className="text-xs text-muted">{t("manualEntrySectionSubtitle")}</p>
        </div>
        {editing === null && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink"
          >
            <Plus className="h-4 w-4" />
            {t("manualEntryAddCta")}
          </button>
        )}
      </div>

      {editing !== null && (
        <div className="mb-4">
          <ManualEntryForm
            services={services}
            chairs={chairs}
            initial={editing === "new" ? undefined : editing}
            busy={create.isPending || update.isPending}
            onCancel={() => setEditing(null)}
            onSubmit={(values) => {
              if (editing === "new") {
                create.mutate(values, { onSuccess: () => setEditing(null) });
              } else {
                update.mutate({ entryId: editing.id, values }, { onSuccess: () => setEditing(null) });
              }
            }}
          />
        </div>
      )}

      {isPending ? (
        <div className="grid min-h-24 place-items-center">
          <Spinner className="h-5 w-5 text-muted" />
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<NotebookPen className="h-6 w-6" />}
          title={t("manualEntryEmptyTitle")}
          description={t("manualEntryEmptyDesc")}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-2.5 rounded-2xl border border-line bg-soft/60 p-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {serviceName(e.service_id)}
                  {e.customer_name ? ` · ${e.customer_name}` : ""}
                </p>
                <p className="text-xs text-muted">
                  {formatBanglaDate(new Date(e.created_at))} · {formatBanglaTime(new Date(e.created_at))}
                  {staffName(e.chair_id) ? ` · ${staffName(e.chair_id)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <p className="font-number text-base font-bold text-ink">৳{formatMoney(e.amount)}</p>
                <StatusPill
                  tone={e.payment_status === "PAID" ? "good" : "brass"}
                  label={e.payment_status === "PAID" ? t("manualEntryCashOption") : t("manualEntryDueOption")}
                />
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(e)}
                  aria-label={t("manualEntryEditAria")}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-soft hover:text-ink"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(e)}
                  aria-label={t("manualEntryDeleteAria")}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-live-soft hover:text-live"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmSheet
        open={deleting !== null}
        title={t("manualEntryDeleteTitle")}
        description={t("manualEntryDeleteDesc")}
        confirmLabel={t("manualEntryDeleteConfirm")}
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
