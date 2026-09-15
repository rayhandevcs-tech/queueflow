import { z } from "zod";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";
import { REFERRAL_POINTS_MAX, REFERRAL_POINTS_MIN } from "../lib/referral";

/**
 * The owner's referral rules.
 *
 * Both bounds mirror the CHECK constraints in `20260923_referral.sql`, so the
 * form refuses first and in Bangla; the database stays the authority.
 *
 * `referral_enabled` is here but `is_enabled` is not: loyalty's own switch
 * belongs to loyalty's form, and this one only ever narrows what that switch
 * already allows (a referral reward *is* a loyalty point).
 */
export function referralSettingsSchema(lang: Language) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);

  const points = z.coerce
    .number()
    .int(m("whole_number_required"))
    .min(REFERRAL_POINTS_MIN)
    .max(REFERRAL_POINTS_MAX, m("rate_too_large"));

  return z.object({
    referral_enabled: z.boolean(),
    referral_referrer_points: points,
    referral_referred_points: points,
  });
}

export type ReferralSettingsFormValues = z.input<ReturnType<typeof referralSettingsSchema>>;
export type ReferralSettingsFormOutput = z.output<ReturnType<typeof referralSettingsSchema>>;
