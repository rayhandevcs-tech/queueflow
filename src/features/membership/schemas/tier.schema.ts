import { z } from "zod";
import { MEMBERSHIP_BENEFIT_KINDS } from "@/types";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";

/**
 * The owner's tier form.
 *
 * Every bound here has a CHECK constraint behind it in
 * `20260921_membership.sql` — this is the copy that produces a Bangla message
 * instead of a Postgres error. The database stays the authority.
 */
export function tierSchema(lang: Language) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);

  const benefit = z.object({
    kind: z.enum(MEMBERSHIP_BENEFIT_KINDS),
    label: z.string().trim().min(2, m("min_chars", 2)).max(80, m("max_chars", 80)),
    // Optional everywhere, meaningful for DISCOUNT. Empty string → undefined so
    // an untouched field doesn't fail as "not a number".
    value: z.preprocess(
      (raw) => (raw === "" || raw === null ? undefined : raw),
      z.coerce.number().int(m("whole_number_required")).min(0).max(100).optional(),
    ),
  });

  return z.object({
    name: z.string().trim().min(2, m("min_chars", 2)).max(40, m("max_chars", 40)),
    description: z.string().trim().max(300, m("max_chars", 300)).optional(),
    price: z.coerce
      .number()
      .int(m("whole_number_required"))
      .min(0)
      .max(1_000_000, m("rate_too_large")),
    duration_days: z.coerce
      .number()
      .int(m("whole_number_required"))
      .min(1, m("min_chars", 1))
      .max(3650, m("max_digits", 4)),
    // Zero benefits is allowed: an owner may be selling a flat discount they
    // describe in the tier's own description, and forcing a benefit row would
    // just produce a placeholder one.
    benefits: z.array(benefit).max(12, m("max_services", 12)),
    is_active: z.boolean(),
    sort_order: z.coerce.number().int().min(0).max(999),
  });
}

export type TierFormValues = z.input<ReturnType<typeof tierSchema>>;
export type TierFormOutput = z.output<ReturnType<typeof tierSchema>>;
