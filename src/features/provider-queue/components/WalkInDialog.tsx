"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, X, Zap } from "lucide-react";
import { keys } from "@/lib/query/keys";
import { getBrowserClient } from "@/lib/supabase/client";
import { UiDbError } from "@/lib/supabase/db-errors";
import { cn } from "@/lib/utils";
import type { Service } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import {
  walkInSchema,
  type WalkInFormValues,
  type WalkInFormOutput,
} from "../schemas/walk-in.schema";
import type { Lane } from "../lib/lanes";
import type { useSerialActions } from "../hooks/use-serial-actions";

async function getActiveServices(shopId: string): Promise<Service[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("created_at");
  if (error) throw error;
  return data;
}

interface Props {
  shopId: string;
  lanes: Lane[];
  actions: ReturnType<typeof useSerialActions>;
  onClose: () => void;
}

export function WalkInDialog({ shopId, lanes, actions, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);

  const { data: services } = useQuery({
    queryKey: keys.services.byShop(shopId),
    queryFn: () => getActiveServices(shopId),
  });

  const form = useForm<WalkInFormValues, unknown, WalkInFormOutput>({
    resolver: zodResolver(walkInSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      serviceIds: [],
      chairId: null,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    actions.walkIn.mutate(values, {
      onSuccess: onClose,
      onError: (err) => {
        if (err instanceof UiDbError && err.silent) return;
        setError(err instanceof Error ? err.message : "Something went wrong");
      },
    });
  });

  const err = form.formState.errors;
  const selectedChair = form.watch("chairId");
  const activeLanes = lanes.filter((l) => !l.chairInactive);

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <UserPlus className="h-5 w-5 text-accent" />
            Walk-in Customer
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-soft hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field error={err.customerName?.message}>
            <Input
              {...form.register("customerName")}
              placeholder="Customer name *"
              invalid={!!err.customerName}
              autoFocus
            />
          </Field>

          <Field error={err.customerPhone?.message}>
            <Input
              {...form.register("customerPhone")}
              placeholder="Phone (optional)"
              inputMode="tel"
              invalid={!!err.customerPhone}
            />
          </Field>

          <Controller
            control={form.control}
            name="serviceIds"
            render={({ field }) => (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">
                  Services *
                </p>
                <div className="flex flex-wrap gap-2">
                  {services?.map((s) => {
                    const on = field.value.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() =>
                          field.onChange(
                            on
                              ? field.value.filter((id) => id !== s.id)
                              : [...field.value, s.id],
                          )
                        }
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition-all",
                          on
                            ? "border-accent bg-accent text-accent-ink shadow-sm"
                            : "border-line bg-card text-muted hover:border-accent/40",
                        )}
                      >
                        {s.name} · ৳{s.rate}
                      </button>
                    );
                  })}
                </div>
                {err.serviceIds && (
                  <p className="mt-1 text-xs text-live">
                    {err.serviceIds.message as string}
                  </p>
                )}
              </div>
            )}
          />

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">Chair</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => form.setValue("chairId", null)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                  selectedChair === null
                    ? "border-accent bg-accent text-accent-ink shadow-sm"
                    : "border-line bg-card text-muted hover:border-accent/40",
                )}
              >
                <Zap className="h-3.5 w-3.5" />
                Auto
              </button>
              {activeLanes.map((lane) => (
                <button
                  key={lane.chair.id}
                  type="button"
                  onClick={() => form.setValue("chairId", lane.chair.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-all",
                    selectedChair === lane.chair.id
                      ? "border-accent bg-accent text-accent-ink shadow-sm"
                      : "border-line bg-card text-muted hover:border-accent/40",
                  )}
                >
                  {lane.chair.staff_name || lane.chair.label} · ~
                  {lane.backlogMin}min
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-live">{error}</p>}

          <Button
            type="submit"
            size="lg"
            loading={actions.walkIn.isPending}
            className="w-full"
          >
            {actions.walkIn.isPending ? "Adding…" : "Add to queue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
