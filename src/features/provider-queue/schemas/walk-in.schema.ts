import { z } from "zod";
import { LIMITS } from "@/config/constants";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";

export function walkInSchema(lang: Language) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);
  return z.object({
    customerName: z
      .string()
      .trim()
      .min(1, m("customer_name_required"))
      .max(80, m("max_chars", 80)),
    customerPhone: z
      .string()
      .trim()
      .max(LIMITS.MAX_PHONE_LENGTH, m("max_digits", LIMITS.MAX_PHONE_LENGTH))
      .regex(/^[0-9+\-\s]*$/, m("phone_digits_only"))
      .or(z.literal(""))
      .transform((v) => (v === "" ? null : v)),
    serviceIds: z
      .array(z.string().uuid())
      .min(1, m("choose_one_service"))
      .max(LIMITS.MAX_SERVICES_PER_SERIAL, m("max_services", LIMITS.MAX_SERVICES_PER_SERIAL)),
    /** null → auto (DB picks the earliest-finish chair) */
    chairId: z.string().uuid().nullable().default(null),
  });
}

export type WalkInFormValues = z.input<ReturnType<typeof walkInSchema>>;
export type WalkInFormOutput = z.output<ReturnType<typeof walkInSchema>>;
