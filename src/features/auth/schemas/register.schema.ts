import { z } from "zod";
import { ROLES, SELECTABLE_BUSINESS_TYPES } from "@/config/constants";
import { CUSTOMER_PREFERENCES } from "@/lib/customer-preference";
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
      /** The shop's own kind — what it runs. Providers only. */
      businessType: z.enum(SELECTABLE_BUSINESS_TYPES).optional(),
      /**
       * The customer's preferred experience — which dashboard opens first.
       * A different thing from `businessType` above, on purpose: one is a
       * business fact about a shop, the other a default for a person.
       */
      preferredBusinessType: z.enum(CUSTOMER_PREFERENCES).optional(),
    })
    .refine((v) => v.password === v.confirmPassword, {
      message: m("passwords_dont_match"),
      path: ["confirmPassword"],
    })
    .refine((v) => v.role !== ROLES.PROVIDER || !!v.businessType, {
      message: m("business_type_required"),
      path: ["businessType"],
    })
    // Required of a customer for the same reason the shop's type is required
    // of an owner: the answer decides which experience they land in, and
    // guessing on their behalf is exactly what the nullable column exists to
    // avoid. A legacy account may have no preference; a new one should not
    // start life that way.
    .refine((v) => v.role !== ROLES.CUSTOMER || !!v.preferredBusinessType, {
      message: m("preferred_business_type_required"),
      path: ["preferredBusinessType"],
    });
}

export type RegisterFormValues = z.infer<ReturnType<typeof registerSchema>>;
