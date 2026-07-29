"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import {
  offerSchema,
  type OfferFormValues,
  type OfferFormOutput,
} from "../schemas/offer.schema";

export function OfferForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (values: OfferFormOutput) => void;
  onCancel: () => void;
}) {
  const form = useForm<OfferFormValues, unknown, OfferFormOutput>({
    resolver: zodResolver(offerSchema),
    defaultValues: { title: "", description: "", discount_pct: 10, valid_until: "" },
  });

  const err = form.formState.errors;

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(values))}
      className="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-soft p-4 shadow-xs sm:grid-cols-2"
    >
      <div className="sm:col-span-2">
        <Field error={err.title?.message}>
          <Input
            {...form.register("title")}
            placeholder="অফারের নাম (ঈদ স্পেশাল)"
            invalid={!!err.title}
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field error={err.description?.message}>
          <Input
            {...form.register("description")}
            placeholder="বিস্তারিত (ঐচ্ছিক)"
            invalid={!!err.description}
          />
        </Field>
      </div>
      <Field error={err.discount_pct?.message}>
        <Input
          {...form.register("discount_pct")}
          type="number"
          inputMode="numeric"
          placeholder="ছাড় (%)"
          invalid={!!err.discount_pct}
        />
      </Field>
      <Field error={err.valid_until?.message}>
        <Input
          {...form.register("valid_until")}
          type="date"
          invalid={!!err.valid_until}
        />
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" loading={busy}>
          {busy ? "সেভ হচ্ছে…" : "অফার তৈরি করো"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          বাতিল
        </Button>
      </div>
    </form>
  );
}
