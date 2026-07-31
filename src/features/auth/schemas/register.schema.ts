import { z } from "zod";
import { ROLES, SELECTABLE_BUSINESS_TYPES } from "@/config/constants";
import { BD_PHONE_REGEX } from "@/lib/phone";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";

export function registerSchema(lang: Language) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);
  return z
    .object({
      fullName: z.string().trim().min(2, m("min_chars", 2)).max(80, m("max_chars", 80)),
      email: z.string().trim().min(1, m("required_email")).email(m("invalid_email")),
      phone: z
        .string()
        .trim()
        .regex(BD_PHONE_REGEX, m("invalid_bd_phone")),
      password: z.string().min(6, m("password_min_6")),
      confirmPassword: z.string().min(6, m("password_min_6")),
      role: z.enum([ROLES.CUSTOMER, ROLES.PROVIDER], {
        message: m("account_type_required"),
      }),
      businessType: z.enum(SELECTABLE_BUSINESS_TYPES).optional(),
    })
    .refine((v) => v.password === v.confirmPassword, {
      message: m("passwords_dont_match"),
      path: ["confirmPassword"],
    })
    .refine((v) => v.role !== ROLES.PROVIDER || !!v.businessType, {
      message: m("business_type_required"),
      path: ["businessType"],
    });
}

export type RegisterFormValues = z.infer<ReturnType<typeof registerSchema>>;
