"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Service } from "@/types";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import {
  serviceSchema,
  type ServiceFormValues,
  type ServiceFormOutput,
} from "../schemas/service.schema";

interface Props {
  initial?: Service;
  busy: boolean;
  onSubmit: (values: ServiceFormOutput) => void;
  onCancel: () => void;
}

export function ServiceForm({ initial, busy, onSubmit, onCancel }: Props) {
  const form = useForm<ServiceFormValues, unknown, ServiceFormOutput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: initial?.name ?? "",
      rate: initial?.rate ?? 0,
      default_duration_min: initial?.default_duration_min ?? 30,
    },
  });

  const err = form.formState.errors;

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      className="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-soft p-4 shadow-xs sm:grid-cols-4"
    >
      <div className="sm:col-span-2">
        <Field error={err.name?.message}>
          <Input
            {...form.register("name")}
            placeholder="Service name (Haircut)"
            invalid={!!err.name}
          />
        </Field>
      </div>
      <Field error={err.rate?.message}>
        <Input
          {...form.register("rate")}
          type="number"
          inputMode="numeric"
          placeholder="Rate (৳)"
          invalid={!!err.rate}
        />
      </Field>
      <Field error={err.default_duration_min?.message}>
        <Input
          {...form.register("default_duration_min")}
          type="number"
          inputMode="numeric"
          placeholder="Duration (min)"
          invalid={!!err.default_duration_min}
        />
      </Field>
      <div className="flex gap-2 sm:col-span-4">
        <Button type="submit" loading={busy}>
          {busy ? "Saving…" : initial ? "Update" : "Add"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
