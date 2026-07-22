"use client";

import { useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Service } from "@/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useServiceMutations, useServices } from "../hooks/use-services";
import { serviceEmoji } from "../lib/service-icon";
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[27px] font-bold text-ink">সার্ভিস ও রেট</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            রেট স্বচ্ছ রাখলে কাস্টমারের হিসাবও পরিষ্কার থাকে
          </p>
        </div>
        {editing === null && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink"
          >
            <Plus className="h-4 w-4" />
            নতুন সার্ভিস
          </button>
        )}
      </div>

      {editing !== null && (
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
          title="এখনো কোনো সার্ভিস যোগ করা হয়নি"
          description="প্রথম সার্ভিস যোগ করো, কাস্টমাররা বুকিং শুরু করতে পারবে।"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {services?.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setEditing(s)}
              className="flex items-center gap-3.5 rounded-2xl border border-line bg-card p-4 text-left transition-shadow hover:shadow-sm"
            >
              <div className="grid h-11.5 w-11.5 shrink-0 place-items-center rounded-[13px] bg-soft text-xl">
                {serviceEmoji(s.name)}
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
                <p className="text-xs text-muted">আনুমানিক {s.default_duration_min} মিনিট</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-number text-lg font-bold text-ink">৳{s.rate}</p>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleActive.mutate({ serviceId: s.id, isActive: !s.is_active });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleActive.mutate({ serviceId: s.id, isActive: !s.is_active });
                    }
                  }}
                  className="text-[11px] font-semibold"
                  style={{ color: s.is_active ? "var(--color-good)" : "var(--color-muted)" }}
                >
                  ● {s.is_active ? "চালু" : "বন্ধ"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
