import { z } from "zod";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";

export function chairSchema(lang: Language) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);
  return z.object({
    label: z.string().trim().min(1, m("label_required")).max(40, m("max_chars", 40)),
    staff_name: z.string().trim().max(80, m("max_chars", 80)).default(""),
    // Uploaded before the chair exists — the storage path is keyed by shop,
    // not by chair, so the photo can be chosen while creating rather than
    // only after saving.
    staff_avatar_url: z.string().nullable().default(null),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, m("invalid_color"))
      .nullable()
      .default(null),
    // Kept as a string through the form so an empty box reads as 0 rather
    // than NaN; the coercion happens once, here.
    commission_pct: z.coerce
      .number()
      .min(0, m("commission_range"))
      .max(100, m("commission_range"))
      .default(0),
  });
}

export type ChairFormValues = z.input<ReturnType<typeof chairSchema>>;
export type ChairFormOutput = z.output<ReturnType<typeof chairSchema>>;
