"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { CHAIR_COLORS } from "@/config/constants";
import { cn } from "@/lib/utils";
import type { Chair } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import {
  chairSchema,
  type ChairFormValues,
  type ChairFormOutput,
} from "../schemas/chair.schema";

interface Props {
  initial?: Chair;
  busy: boolean;
  onSubmit: (values: ChairFormOutput) => void;
  onCancel: () => void;
}

export function ChairForm({ initial, busy, onSubmit, onCancel }: Props) {
  const form = useForm<ChairFormValues, unknown, ChairFormOutput>({
    resolver: zodResolver(chairSchema),
    defaultValues: {
      label: initial?.label ?? "",
      staff_name: initial?.staff_name ?? "",
      color: initial?.color ?? CHAIR_COLORS[0],
    },
  });

  const err = form.formState.errors;
  const selectedColor = form.watch("color");

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      className="space-y-3 rounded-2xl border border-line bg-soft p-4 shadow-xs"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field error={err.label?.message}>
          <Input
            {...form.register("label")}
            placeholder="Label (Chair 1)"
            invalid={!!err.label}
          />
        </Field>
        <Field error={err.staff_name?.message}>
          <Input
            {...form.register("staff_name")}
            placeholder="Staff name (Rahim)"
            invalid={!!err.staff_name}
          />
        </Field>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-medium text-muted">Lane color</span>
        <div className="flex gap-2">
          {CHAIR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => form.setValue("color", c, { shouldDirty: true })}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-full border-2 text-accent-ink transition-all",
                selectedColor === c
                  ? "scale-110 border-ink shadow-sm"
                  : "border-transparent",
              )}
              style={{ backgroundColor: c }}
              aria-label={c}
            >
              {selectedColor === c && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" loading={busy}>
          {busy ? "Saving…" : initial ? "Update" : "Add chair"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
