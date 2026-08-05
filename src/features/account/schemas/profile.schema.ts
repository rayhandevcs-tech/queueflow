import { z } from "zod";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";

export function profileSchema(lang: Language) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);
  return z.object({
    fullName: z.string().trim().min(2, m("min_chars", 2)).max(80, m("max_chars", 80)),
    phone: z
      .string()
      .trim()
      .max(20, m("max_digits", 20))
      .regex(/^[0-9+\-\s]*$/, m("phone_digits_only"))
      .or(z.literal(""))
      .nullable()
      .transform((v) => (v === "" || v === null ? null : v)),
    gender: z.enum(["male", "female", "other"]).nullable().optional(),
    dateOfBirth: z.string().nullable().optional(),
    address: z
      .string()
      .trim()
      .max(300, m("max_chars", 300))
      .nullable()
      .optional(),
    addressLat: z.number().nullable().optional(),
    addressLng: z.number().nullable().optional(),
  });
}

export type ProfileFormValues = z.input<ReturnType<typeof profileSchema>>;
export type ProfileFormOutput = z.output<ReturnType<typeof profileSchema>>;
