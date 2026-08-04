"use client";

import { useState } from "react";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Service } from "@/types";
import type { ServiceCategory } from "@/config/constants";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { StatusPill } from "@/components/ui/StatusPill";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { SERVICE_CATEGORY_ICON } from "@/lib/service-category-icon";
import { isServiceInActiveUse } from "../api/services.api";
import { useServiceMutations, useServices } from "../hooks/use-services";
import { providerCatalogDict } from "../lib/i18n";
import { ServiceForm } from "./ServiceForm";

export function ServicesManager({ shopId }: { shopId: string }) {
  const { data: services, isPending } = useServices(shopId);
  const { create, update, toggleActive, remove } = useServiceMutations(shopId);
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [deleting, setDeleting] = useState<Service | null>(null);
  const [deleteWarning, setDeleteWarning] = useState(false);
  const [checkingDelete, setCheckingDelete] = useState(false);
  const t = useT(providerCatalogDict);
  const showToast = useToast();

  async function startDelete(service: Service) {
    setCheckingDelete(true);
    setDeleting(service);
    setDeleteWarning(await isServiceInActiveUse(shopId, service.id));
    setCheckingDelete(false);
  }

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
          <h1 className="font-display text-[27px] font-bold text-ink">{t("servicesPageTitle")}</h1>
          <p className="mt-0.5 text-[13px] text-muted">{t("servicesPageSubtitle")}</p>
        </div>
        {editing === null && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
          >
            <Plus className="h-4 w-4" />
            {t("newServiceCta")}
          </button>
        )}
      </div>

      {editing !== null && (
        <ServiceForm
          shopId={shopId}
          initial={editing === "new" ? undefined : editing}
          busy={create.isPending || update.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={(values) => {
            if (editing === "new") {
              create.mutate(values, { onSuccess: () => setEditing(null) });
            } else {
              update.mutate(
                { serviceId: editing.id, values },
                { onSuccess: () => setEditing(null) },
              );
            }
          }}
        />
      )}

      {services?.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-6 w-6" />}
          title={t("noServicesTitle")}
          description={t("noServicesDesc")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {services?.map((s) => {
            const CategoryIcon = SERVICE_CATEGORY_ICON[(s.category as ServiceCategory) ?? "OTHER"];
            return (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-2xl border border-line bg-card p-4 transition-shadow hover:shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                >
                  <div className="grid h-11.5 w-11.5 shrink-0 place-items-center overflow-hidden rounded-[13px] bg-soft text-muted">
                    {s.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <CategoryIcon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-[15px] font-semibold text-ink",
                        !s.is_active && "text-muted line-through",
                      )}
                    >
                      {s.name}
                    </p>
                    <p className="text-xs text-muted">{t("estimatedMinutes", s.default_duration_min)}</p>
                  </div>
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <p className="font-number text-lg font-bold text-ink">৳{s.rate}</p>
                  <button
                    type="button"
                    onClick={() => toggleActive.mutate({ serviceId: s.id, isActive: !s.is_active })}
                  >
                    <StatusPill
                      tone={s.is_active ? "good" : "neutral"}
                      label={s.is_active ? t("serviceActiveWord") : t("serviceInactiveWord")}
                    />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void startDelete(s)}
                  aria-label={t("deleteServiceAria")}
                  className="grid h-9 w-9 shrink-0 place-items-center self-start rounded-lg text-muted transition-colors hover:bg-live-soft hover:text-live"
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
        title={t("deleteServiceTitle")}
        description={deleteWarning ? t("deleteServiceActiveWarning") : t("deleteServiceDesc")}
        confirmLabel={t("deleteServiceConfirm")}
        loading={checkingDelete || remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: ({ deleted }) => {
              if (!deleted) showToast(t("deleteServiceFallbackNote"));
              setDeleting(null);
            },
          });
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
