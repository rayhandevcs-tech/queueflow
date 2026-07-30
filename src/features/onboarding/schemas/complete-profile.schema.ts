import { z } from "zod";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";

export function completeProfileSchema(lang: Language) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);
  return z.object({
    phone: z
      .string()
      .trim()
      .max(20, m("max_digits", 20))
      .regex(/^[0-9+\-\s]*$/, m("phone_digits_only"))
      .or(z.literal(""))
      .nullable()
      .transform((v) => (v === "" || v === null ? null : v)),
    gender: z
      .enum(["male", "female", "other"])
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    avatarUrl: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  });
}

export type CompleteProfileFormValues = z.input<ReturnType<typeof completeProfileSchema>>;
export type CompleteProfileFormOutput = z.output<ReturnType<typeof completeProfileSchema>>;
