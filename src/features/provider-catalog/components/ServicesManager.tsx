"use client";

import { useState } from "react";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import type { Service } from "@/types";
import type { ServiceCategory } from "@/config/constants";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { StatusPill } from "@/components/ui/StatusPill";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { ServiceCard, ServiceCardGrid } from "@/components/ui/ServiceCard";
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
        <ServiceCardGrid>
          {services?.map((s) => {
            const CategoryIcon = SERVICE_CATEGORY_ICON[(s.category as ServiceCategory) ?? "OTHER"];
            return (
              <ServiceCard
                key={s.id}
                name={s.name}
                imageUrl={s.image_url}
                fallbackIcon={<CategoryIcon className="h-8 w-8" />}
                durationLabel={t("estimatedMinutes", s.default_duration_min)}
                priceLabel={`৳${s.rate}`}
                dimmed={!s.is_active}
                onClick={() => setEditing(s)}
                badge={
                  <button
                    type="button"
                    onClick={(e) => {
                      // The card behind this opens the editor; the pill is its
                      // own control and must not drag the editor open with it.
                      e.stopPropagation();
                      toggleActive.mutate({ serviceId: s.id, isActive: !s.is_active });
                    }}
                  >
                    <StatusPill
                      tone={s.is_active ? "good" : "neutral"}
                      label={s.is_active ? t("serviceActiveWord") : t("serviceInactiveWord")}
                    />
                  </button>
                }
                action={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void startDelete(s);
                    }}
                    aria-label={t("deleteServiceAria")}
                    className="grid h-8 w-8 place-items-center rounded-lg bg-card/85 text-muted backdrop-blur-sm transition-colors hover:bg-live-soft hover:text-live"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                }
              />
            );
          })}
        </ServiceCardGrid>
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
