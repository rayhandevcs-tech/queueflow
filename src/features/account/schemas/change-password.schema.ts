import { z } from "zod";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";

export function changePasswordSchema(lang: Language) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);
  return z
    .object({
      currentPassword: z.string().min(1, m("current_password_required")),
      newPassword: z.string().min(6, m("password_min_6")),
      confirmPassword: z.string().min(6, m("password_min_6")),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      message: m("passwords_dont_match"),
      path: ["confirmPassword"],
    });
}

export type ChangePasswordFormValues = z.infer<ReturnType<typeof changePasswordSchema>>;
