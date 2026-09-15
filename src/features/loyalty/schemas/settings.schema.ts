import { z } from "zod";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";
import { TAKA_PER_POINT_MAX, TAKA_PER_POINT_MIN } from "../lib/loyalty";

/**
 * The owner's programme rules.
 *
 * Both bounds mirror CHECK constraints in `20260922_loyalty.sql`, so the form
 * refuses first and in Bangla; the database stays the authority.
 */
export function loyaltySettingsSchema(lang: Language) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);

  return z.object({
    is_enabled: z.boolean(),
    taka_per_point: z.coerce
      .number()
      .int(m("whole_number_required"))
      .min(TAKA_PER_POINT_MIN, m("min_chars", TAKA_PER_POINT_MIN))
      .max(TAKA_PER_POINT_MAX, m("rate_too_large")),
    min_bill_taka: z.coerce
      .number()
      .int(m("whole_number_required"))
      .min(0)
      .max(1_000_000, m("rate_too_large")),
  });
}

export type LoyaltySettingsFormValues = z.input<ReturnType<typeof loyaltySettingsSchema>>;
export type LoyaltySettingsFormOutput = z.output<ReturnType<typeof loyaltySettingsSchema>>;
