import { z } from "zod";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";

export function manualEntrySchema(lang: Language) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);
  return z.object({
    service_id: z.string().min(1, m("service_required")),
    // Native <select> can only emit "", never null — collapse it here so
    // "no staff picked" reaches the DB as an actual null, not the string "".
    chair_id: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v ? v : null)),
    amount: z.coerce.number().min(1, m("amount_min_1")).max(999999, m("rate_too_large")),
    payment_status: z.enum(["PAID", "DUE"]),
    // The manual-entry form only offers a cash/due toggle (not the full
    // accepted-methods list) — null when payment_status is DUE, same
    // convention as serials.payment_method.
    payment_method: z.string().nullable().optional(),
    customer_name: z
      .string()
      .trim()
      .max(80, m("max_chars", 80))
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
  });
}

export type ManualEntryFormValues = z.input<ReturnType<typeof manualEntrySchema>>;
export type ManualEntryFormOutput = z.output<ReturnType<typeof manualEntrySchema>>;
