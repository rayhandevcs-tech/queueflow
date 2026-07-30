import { z } from "zod";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";

export function offerSchema(lang: Language) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);
  return z.object({
    title: z.string().trim().min(2, m("min_chars", 2)).max(60, m("max_chars", 60)),
    description: z.string().trim().max(200, m("max_chars", 200)).optional(),
    discount_pct: z.coerce
      .number()
      .int(m("whole_number_required"))
      .min(1, m("discount_min_1"))
      .max(90, m("discount_max_90")),
    valid_until: z.string().min(1, m("valid_until_required")),
  });
}

export type OfferFormValues = z.input<ReturnType<typeof offerSchema>>;
export type OfferFormOutput = z.output<ReturnType<typeof offerSchema>>;
