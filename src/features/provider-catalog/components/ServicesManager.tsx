"use client";

import { useState } from "react";
import { ListChecks, Pencil, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Service } from "@/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useServiceMutations, useServices } from "../hooks/use-services";
import { ServiceForm } from "./ServiceForm";

export function ServicesManager({ shopId }: { shopId: string }) {
  const { data: services, isPending } = useServices(shopId);
  const { create, update, toggleActive } = useServiceMutations(shopId);
  const [editing, setEditing] = useState<Service | "new" | null>(null);

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
          New service
        </Button>
      ) : (
        <ServiceForm
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
          title="No services yet"
          description="Add your first service so customers can start booking."
        />
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-card shadow-sm">
          {services?.map((s) => (
            <li key={s.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-semibold text-ink",
                    !s.is_active && "text-muted line-through",
                  )}
                >
                  {s.name}
                </p>
                <p className="text-xs text-muted">
                  ৳{s.rate} · ~{s.default_duration_min} min
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
              <button
                onClick={() =>
                  toggleActive.mutate({ serviceId: s.id, isActive: !s.is_active })
                }
              >
                <Badge variant={s.is_active ? "good" : "neutral"}>
                  {s.is_active ? "Active" : "Off"}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
