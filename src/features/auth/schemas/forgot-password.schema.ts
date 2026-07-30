import { z } from "zod";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";

export function forgotPasswordSchema(lang: Language) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);
  return z.object({
    email: z.string().trim().min(1, m("required_email")).email(m("invalid_email")),
  });
}

export type ForgotPasswordFormValues = z.infer<ReturnType<typeof forgotPasswordSchema>>;
