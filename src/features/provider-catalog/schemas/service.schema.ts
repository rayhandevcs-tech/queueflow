import { z } from "zod";
import { SERVICE_CATEGORIES } from "@/config/constants";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";

export function serviceSchema(lang: Language) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);
  return z.object({
    name: z.string().trim().min(2, m("min_chars", 2)).max(60, m("max_chars", 60)),
    rate: z.coerce.number().min(0, m("rate_min_0")).max(99999, m("rate_too_large")),
    default_duration_min: z.coerce
      .number()
      .int(m("whole_number_required"))
      .min(1, m("duration_min_1"))
      .max(480, m("duration_max_480")),
    category: z.enum(SERVICE_CATEGORIES).nullable().optional(),
  });
}

export type ServiceFormValues = z.input<ReturnType<typeof serviceSchema>>;
export type ServiceFormOutput = z.output<ReturnType<typeof serviceSchema>>;
