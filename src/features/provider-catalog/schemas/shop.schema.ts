import { z } from "zod";
import { SELECTABLE_BUSINESS_TYPES } from "@/config/constants";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";

export function shopSchema(lang: Language) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);
  return z.object({
    name: z.string().trim().min(2, m("min_chars", 2)).max(80, m("max_chars", 80)),
    address: z.string().trim().max(300, m("max_chars", 300)).default(""),
    phone: z
      .string()
      .trim()
      .max(20, m("max_digits", 20))
      .regex(/^[0-9+\-\s]*$/, m("phone_digits_only"))
      .or(z.literal(""))
      .nullable()
      .transform((v) => (v === "" || v === null ? null : v)),
    // Validator enforces product policy: SALON | PARLOUR only.
    business_type: z.enum(SELECTABLE_BUSINESS_TYPES),
    latitude: z.number().min(-90).max(90).nullable().default(null),
    longitude: z.number().min(-180).max(180).nullable().default(null),
  });
}

export type ShopFormValues = z.input<ReturnType<typeof shopSchema>>;
export type ShopFormOutput = z.output<ReturnType<typeof shopSchema>>;
