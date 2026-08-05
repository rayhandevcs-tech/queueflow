"use client";

import { useState } from "react";
import { Armchair, Pencil, Plus, Trash2 } from "lucide-react";
import type { Chair } from "@/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { isChairInActiveUse } from "../api/chairs.api";
import { useChairMutations, useChairs } from "../hooks/use-chairs";
import { providerCatalogDict } from "../lib/i18n";
import { ChairForm } from "./ChairForm";
import { ImageUploadField } from "./ImageUploadField";

export function ChairsManager({ shopId }: { shopId: string }) {
  const { data: chairs, isPending } = useChairs(shopId);
  const { create, update, toggleActive, remove } = useChairMutations(shopId);
  const [editing, setEditing] = useState<Chair | "new" | null>(null);
  const [deleting, setDeleting] = useState<Chair | null>(null);
  const [deleteWarning, setDeleteWarning] = useState(false);
  const [checkingDelete, setCheckingDelete] = useState(false);
  const t = useT(providerCatalogDict);
  const showToast = useToast();

  async function startDelete(chair: Chair) {
    setCheckingDelete(true);
    setDeleting(chair);
    setDeleteWarning(await isChairInActiveUse(shopId, chair.id));
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
    <div className="space-y-4">
      {editing === null ? (
        <Button onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" />
          {t("newChairCta")}
        </Button>
      ) : (
        <ChairForm
          initial={editing === "new" ? undefined : editing}
          busy={create.isPending || update.isPending}
          onCancel={() => setEditing(null)}
          onSubmit={(values) => {
            if (editing === "new") {
              create.mutate(values, { onSuccess: () => setEditing(null) });
            } else {
              update.mutate(
                { chairId: editing.id, patch: values },
                { onSuccess: () => setEditing(null) },
              );
            }
          }}
        />
      )}

      {chairs?.length === 0 ? (
        <EmptyState
          icon={<Armchair className="h-6 w-6" />}
          title={t("noChairsYetTitle")}
          description={t("noChairsYetDesc")}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {chairs?.map((chair) => (
            <li
              key={chair.id}
              className="rounded-2xl border border-line bg-card p-4 shadow-sm"
              style={{ borderLeftWidth: 4, borderLeftColor: chair.color ?? "#cbd5e1" }}
            >
              <div className="flex items-start gap-3">
                <ImageUploadField
                  shopId={shopId}
                  kind="avatar"
                  label=""
                  currentUrl={chair.staff_avatar_url}
                  onUploaded={(url) =>
                    update.mutate({
                      chairId: chair.id,
                      patch: { staff_avatar_url: url },
                    })
                  }
                />
                <div className="min-w-0 flex-1 pt-1">
                  <p className="truncate text-sm font-semibold text-ink">{chair.label}</p>
                  <p className="truncate text-xs text-muted">
                    {chair.staff_name || t("chairNoStaffName")}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(chair)}
                    >
                      <Pencil className="h-3 w-3" />
                      {t("chairEditCta")}
                    </Button>
                    <button
                      onClick={() =>
                        toggleActive.mutate({
                          chairId: chair.id,
                          isActive: !chair.is_active,
                        })
                      }
                    >
                      <Badge variant={chair.is_active ? "good" : "neutral"}>
                        {chair.is_active ? t("chairActiveWord") : t("chairPausedWord")}
                      </Badge>
                    </button>
                    <button
                      type="button"
                      onClick={() => void startDelete(chair)}
                      aria-label={t("deleteChairAria")}
                      className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-live-soft hover:text-live"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmSheet
        open={deleting !== null}
        title={t("deleteChairTitle")}
        description={deleteWarning ? t("deleteChairActiveWarning") : t("deleteChairDesc")}
        confirmLabel={t("deleteChairConfirm")}
        loading={checkingDelete || remove.isPending}
        onConfirm={() => {
          if (!deleting) return;
          remove.mutate(deleting.id, {
            onSuccess: ({ deleted }) => {
              if (!deleted) showToast(t("deleteChairFallbackNote"));
              setDeleting(null);
            },
          });
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
