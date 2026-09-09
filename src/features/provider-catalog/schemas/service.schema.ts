import { z } from "zod";
import { SERVICE_CATEGORIES, type ServiceCategory } from "@/config/constants";
import { MAX_DURATION_MIN } from "@/lib/duration";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";

/**
 * `allowed` narrows the category to the ones this shop's picker offers
 * (`categoriesFor(businessType, service.category)`), so a value the UI never
 * showed cannot be posted.
 *
 * It defaults to every category on purpose: the database's
 * `services_category_check` accepts all twelve for every shop, and the
 * relationship between the two is that **the form is stricter, never looser**.
 * A salon's existing BRIDAL row stays editable because the caller passes its
 * current value through `categoriesFor`'s `keep` argument.
 */
export function serviceSchema(
  lang: Language,
  allowed: readonly ServiceCategory[] = SERVICE_CATEGORIES,
) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);
  return z.object({
    name: z.string().trim().min(2, m("min_chars", 2)).max(60, m("max_chars", 60)),
    rate: z.coerce.number().min(0, m("rate_min_0")).max(99999, m("rate_too_large")),
    // Minutes stay the stored unit (see `src/lib/duration.ts`); the form
    // collects hours and minutes and joins them before they reach here.
    default_duration_min: z.coerce
      .number()
      .int(m("whole_number_required"))
      .min(1, m("duration_min_1"))
      .max(MAX_DURATION_MIN, m("duration_max_480")),
    category: z
      .enum(SERVICE_CATEGORIES)
      .nullable()
      .optional()
      .refine((value) => !value || allowed.includes(value), m("category_invalid")),
    // No .default() — stays `undefined` (dropped from the JSON payload
    // Supabase sends) unless actually touched, so services.image_url being
    // pending its migration doesn't break plain create/edit for everyone.
    image_url: z.string().nullable().optional(),
  });
}

export type ServiceFormValues = z.input<ReturnType<typeof serviceSchema>>;
export type ServiceFormOutput = z.output<ReturnType<typeof serviceSchema>>;
