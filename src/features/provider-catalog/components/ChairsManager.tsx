"use client";

import { useState } from "react";
import { Armchair, Pencil, Plus } from "lucide-react";
import type { Chair } from "@/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useChairMutations, useChairs } from "../hooks/use-chairs";
import { ChairForm } from "./ChairForm";
import { ImageUploadField } from "./ImageUploadField";

export function ChairsManager({ shopId }: { shopId: string }) {
  const { data: chairs, isPending } = useChairs(shopId);
  const { create, update, toggleActive } = useChairMutations(shopId);
  const [editing, setEditing] = useState<Chair | "new" | null>(null);

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
          New chair
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
          title="No chairs yet"
          description="Add your first chair or staff lane to start taking serials."
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
                    {chair.staff_name || "No staff name"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(chair)}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
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
                        {chair.is_active ? "Active" : "Paused"}
                      </Badge>
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
