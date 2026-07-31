"use client";

import { useMemo, useState } from "react";
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
import { BottomSheet } from "@/components/ui/BottomSheet";
import { AvatarChip } from "@/components/ui/AvatarChip";
import { useLanguage, useT } from "@/lib/i18n";
import {
  walkInSchema,
  type WalkInFormValues,
  type WalkInFormOutput,
} from "../schemas/walk-in.schema";
import type { Lane } from "../lib/lanes";
import type { useSerialActions } from "../hooks/use-serial-actions";
import { providerQueueDict } from "../lib/i18n";

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
  const { language } = useLanguage();
  const t = useT(providerQueueDict);

  const { data: services } = useQuery({
    queryKey: keys.services.byShop(shopId),
    queryFn: () => getActiveServices(shopId),
  });

  const schema = useMemo(() => walkInSchema(language), [language]);
  const form = useForm<WalkInFormValues, unknown, WalkInFormOutput>({
    resolver: zodResolver(schema),
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
        setError(err instanceof Error ? err.message : t("somethingWrong"));
      },
    });
  });

  const err = form.formState.errors;
  const selectedChair = form.watch("chairId");
  const activeLanes = lanes.filter((l) => !l.chairInactive);

  return (
    <BottomSheet open onClose={onClose} maxWidthClassName="max-w-md">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <UserPlus className="h-5 w-5 text-accent" />
          {t("walkInCustomerTitle")}
        </h2>
        <button
          type="button"
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
            placeholder={t("customerNamePlaceholder")}
            invalid={!!err.customerName}
            autoFocus
          />
        </Field>

        <Field error={err.customerPhone?.message}>
          <Input
            {...form.register("customerPhone")}
            placeholder={t("phoneOptionalPlaceholder")}
            inputMode="tel"
            invalid={!!err.customerPhone}
          />
        </Field>

        <Controller
          control={form.control}
          name="serviceIds"
          render={({ field }) => (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">{t("servicesLabel")}</p>
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
          <p className="mb-1.5 text-xs font-medium text-muted">{t("chairLabel")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => form.setValue("chairId", null)}
              className={cn(
                "flex w-20 flex-col items-center gap-1 rounded-xl border px-2 py-2 text-center transition-all",
                selectedChair === null
                  ? "border-accent bg-accent shadow-sm"
                  : "border-line bg-card hover:border-accent/40 hover:bg-soft",
              )}
            >
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full",
                  selectedChair === null ? "bg-accent-ink/15" : "bg-soft",
                )}
              >
                <Zap className={cn("h-4 w-4", selectedChair === null ? "text-accent-ink" : "text-accent")} />
              </span>
              <span
                className={cn(
                  "w-full truncate text-[11px] font-semibold",
                  selectedChair === null ? "text-accent-ink" : "text-ink",
                )}
              >
                {t("autoChair")}
              </span>
            </button>
            {activeLanes.map((lane) => {
              const selected = selectedChair === lane.chair.id;
              return (
                <button
                  key={lane.chair.id}
                  type="button"
                  onClick={() => form.setValue("chairId", lane.chair.id)}
                  className={cn(
                    "flex w-20 flex-col items-center gap-1 rounded-xl border px-2 py-2 text-center transition-all",
                    selected
                      ? "border-accent bg-accent shadow-sm"
                      : "border-line bg-card hover:border-accent/40 hover:bg-soft",
                  )}
                >
                  <AvatarChip
                    label={lane.chair.staff_name || lane.chair.label}
                    avatarUrl={lane.chair.staff_avatar_url}
                    shape="circle"
                    size={36}
                  />
                  <span
                    className={cn(
                      "w-full truncate text-[11px] font-semibold",
                      selected ? "text-accent-ink" : "text-ink",
                    )}
                  >
                    {lane.chair.staff_name || lane.chair.label}
                  </span>
                  <span className={cn("text-[10px]", selected ? "text-accent-ink/70" : "text-muted")}>
                    {t("backlogSuffixMin", lane.backlogMin)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-sm text-live">{error}</p>}

        <Button type="submit" size="lg" loading={actions.walkIn.isPending} className="w-full">
          {actions.walkIn.isPending ? t("adding") : t("addToQueue")}
        </Button>
      </form>
    </BottomSheet>
  );
}
