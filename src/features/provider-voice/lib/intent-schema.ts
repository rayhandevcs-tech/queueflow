import { z } from "zod";

/**
 * What a spoken sentence can turn into.
 *
 * Deliberately a short list. Every intent here maps onto an action the app
 * already has, with a confirmation step in front of it — voice is a faster way
 * to reach existing buttons, not a second way to change the database. Anything
 * outside the list comes back as `unknown` with a reason, which is a far better
 * outcome than a confident wrong guess about someone's money.
 *
 * Ids rather than names throughout: the model is given the shop's real chairs
 * and services and must pick from them, so "সালামের চুল কাটা" resolves to an
 * actual service row or does not resolve at all. A free-text service name would
 * be a name nothing can be booked against.
 */
export const VoiceIntentSchema = z.object({
  intent: z.enum([
    "add_walk_in",
    "add_expense",
    "add_manual_income",
    "set_shop_open",
    "unknown",
  ]),

  /** Bangla, one line: what you understood, for the confirmation sheet. */
  summary: z.string(),

  /** Set when intent is "unknown" — say plainly what was missing. */
  reason: z.string().nullable(),

  walkIn: z
    .object({
      customerName: z.string(),
      /** Exact service ids from the list given to you. */
      serviceIds: z.array(z.string()),
      /** A chair id from the list, or null to let the app choose. */
      chairId: z.string().nullable(),
    })
    .nullable(),

  expense: z
    .object({
      category: z.enum(["RENT", "UTILITY", "SUPPLIES", "STAFF", "OTHER"]),
      amount: z.number(),
      note: z.string().nullable(),
    })
    .nullable(),

  manualIncome: z
    .object({
      serviceId: z.string(),
      amount: z.number(),
      customerName: z.string().nullable(),
    })
    .nullable(),

  shopOpen: z.object({ open: z.boolean() }).nullable(),
});

export type VoiceIntent = z.infer<typeof VoiceIntentSchema>;
