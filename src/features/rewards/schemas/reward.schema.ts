import { z } from "zod";
import { REWARD_KINDS } from "@/features/rewards/lib/rewards";
import type { Language } from "@/lib/i18n";
import { resolveDict } from "@/lib/i18n";
import { VALIDATION } from "@/lib/i18n/validation-messages";
import {
  DISCOUNT_PCT_MAX,
  POINTS_COST_MAX,
  POINTS_COST_MIN,
  REWARD_DESCRIPTION_MAX,
  REWARD_NAME_MAX,
} from "../lib/rewards";

/**
 * The owner's reward form.
 *
 * Every bound here has a CHECK constraint behind it in
 * `20260924_rewards.sql` — this is the copy that produces a Bangla message
 * instead of a Postgres error. The database stays the authority.
 *
 * The three per-kind shapes are enforced with `superRefine` rather than a
 * discriminated union, because the form keeps one set of fields and swaps
 * which are shown: a union would discard whatever the owner had typed each
 * time they changed the kind.
 */
export function rewardSchema(lang: Language) {
  const m = (key: keyof typeof VALIDATION, ...args: unknown[]) =>
    resolveDict(VALIDATION, lang, key, ...args);

  const blankToUndefined = (raw: unknown) =>
    raw === "" || raw === null ? undefined : raw;

  return z
    .object({
      name: z
        .string()
        .trim()
        .min(2, m("min_chars", 2))
        .max(REWARD_NAME_MAX, m("max_chars", REWARD_NAME_MAX)),
      description: z
        .string()
        .trim()
        .max(REWARD_DESCRIPTION_MAX, m("max_chars", REWARD_DESCRIPTION_MAX))
        .optional(),
      kind: z.enum(REWARD_KINDS),
      points_cost: z.coerce
        .number()
        .int(m("whole_number_required"))
        .min(POINTS_COST_MIN, m("min_chars", POINTS_COST_MIN))
        .max(POINTS_COST_MAX, m("rate_too_large")),
      // Meaningful for the two discount kinds, ignored for FREE_SERVICE.
      value: z.preprocess(
        blankToUndefined,
        z.coerce.number().min(0).max(1_000_000, m("rate_too_large")).optional(),
      ),
      service_id: z.preprocess(blankToUndefined, z.string().uuid().optional()),
      // Empty = unlimited, which is a real answer rather than a missing one.
      stock: z.preprocess(
        blankToUndefined,
        z.coerce.number().int(m("whole_number_required")).min(0).max(1_000_000).optional(),
      ),
      valid_until: z.preprocess(blankToUndefined, z.string().optional()),
      is_active: z.boolean(),
      sort_order: z.coerce.number().int().min(0).max(999),
    })
    .superRefine((values, ctx) => {
      // Mirrors `rewards_value_matches_kind`. Without this the owner would
      // meet a raw constraint violation instead of a field-level message.
      if (values.kind === "FREE_SERVICE") {
        if (!values.service_id) {
          ctx.addIssue({
            code: "custom",
            path: ["service_id"],
            message: m("service_required"),
          });
        }
        return;
      }

      if (values.value == null || values.value <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: m("min_chars", 1),
        });
        return;
      }

      if (values.kind === "DISCOUNT_PCT" && values.value > DISCOUNT_PCT_MAX) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: m("rate_too_large"),
        });
      }
    });
}

export type RewardFormValues = z.input<ReturnType<typeof rewardSchema>>;
export type RewardFormOutput = z.output<ReturnType<typeof rewardSchema>>;
