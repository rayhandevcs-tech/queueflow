import "server-only";
import { z } from "zod";
import {
  MAX_RANGE_SPAN_DAYS,
  rangeProblem,
  presetRange,
  type RangePreset,
} from "@/lib/analytics-range";
import type { ToolContext, ToolDefinition } from "../types";

/**
 * The owner copilot's read tools: eleven thin adapters over the eleven
 * analytics RPCs Sprint 10 already built.
 *
 * ---------------------------------------------------------------------------
 * Thin is the requirement, not a style preference
 * ---------------------------------------------------------------------------
 * Not one number is computed here. Each tool validates its arguments, resolves
 * the shop from the session, calls the same RPC the dashboard calls, and hands
 * the rows back. That is what keeps the assistant and the analytics page
 * incapable of disagreeing: if the copilot ever quoted a no-show rate the
 * owner's own screen contradicted, the owner would stop believing both.
 *
 * It also keeps authorization in one place. Each RPC runs `analytics_scope()`,
 * which checks `is_shop_owner()` and raises `not your shop` — so even a bug in
 * this file cannot read another shop's figures.
 *
 * ---------------------------------------------------------------------------
 * Why this does not import the existing analytics api file
 * ---------------------------------------------------------------------------
 * `src/features/provider-analytics/api/shop-analytics.api.ts` is the same
 * eleven calls, and reusing it was the first thing I tried. It uses
 * `getBrowserClient()`, because it exists to serve React Query in a component
 * — and the agent runs on the server against the cookie-bound client, which is
 * what applies RLS to a request that has no browser.
 *
 * So these are separate call sites but not a separate implementation: same RPC
 * names, same argument names, same `firstRow` semantics. The duplication is
 * eleven `supabase.rpc(...)` lines, and the alternative — a shared module
 * parameterised by client — would have meant editing a working analytics
 * feature during an AI sprint. Worth revisiting once this settles.
 *
 * ---------------------------------------------------------------------------
 * Identity never comes from the model
 * ---------------------------------------------------------------------------
 * No tool below takes `shop_id`, `owner_id` or a user id. There is no argument
 * through which the model could supply one. `ctx.shopId` is resolved from
 * `auth.getUser()` before the model has spoken, and a context without it makes
 * every one of these refuse.
 */

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * The range argument every tool shares.
 *
 * Two ways to say it, because the model is bad at one of them. Asked for
 * "this month" it will happily produce a first-of-month that is right in UTC
 * and a day out in Dhaka, or invent a 31st of February. `preset` lets it name
 * the window and have the SERVER resolve the dates with the project's existing
 * Dhaka-based helpers; explicit `from`/`to` stay available for the comparisons
 * a preset cannot express ("the week before last").
 *
 * This is the whole of rule 11: one timezone policy, and it is the one
 * `presetRange()` already implements. No second convention is introduced here.
 */
const YMD = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .describe("A calendar day, YYYY-MM-DD, interpreted in Asia/Dhaka.");

const RangeArgs = z.object({
  preset: z
    .enum(["TODAY", "LAST_7", "LAST_30", "THIS_MONTH"])
    .optional()
    .describe(
      "Preferred. Names a window the server resolves in Asia/Dhaka. " +
        "Use this instead of guessing dates. Omit it only when you need a " +
        "window these do not cover, and then pass from and to.",
    ),
  from: YMD.optional().describe("Start day. Required when preset is omitted."),
  to: YMD.optional().describe("End day, inclusive. Required when preset is omitted."),
});

type RangeInput = z.infer<typeof RangeArgs>;

/** Raised for an argument problem, so the loop can tell the model what to fix. */
export class ToolArgumentError extends Error {}

/**
 * Turn whatever the model said into a range the RPCs will accept, or refuse.
 *
 * Validation is deliberately identical to the dashboard's: `rangeProblem()` is
 * the same function the range picker uses, so a window the UI would reject is
 * a window the assistant rejects, with the same 1095-day ceiling. The RPC
 * checks it a third time and would raise on its own — this layer exists so the
 * model gets a sentence it can act on instead of a Postgres exception.
 */
function resolveRange(args: RangeInput, now: Date): { from: string; to: string } {
  if (args.preset) {
    const range = presetRange(args.preset as RangePreset, now);
    // Presets are computed by the same helper the UI uses, so they cannot be
    // malformed — but they are still run past the validator rather than
    // trusted, because a preset that ever did produce a bad range should fail
    // here and not inside the database.
    if (rangeProblem(range)) throw new ToolArgumentError("RANGE_INVALID");
    return { from: range.from, to: range.to };
  }

  if (!args.from || !args.to) {
    throw new ToolArgumentError(
      "Pass a preset, or both from and to. A range needs two ends.",
    );
  }

  const problem = rangeProblem({ from: args.from, to: args.to });
  if (problem === "MALFORMED") throw new ToolArgumentError("Those are not real dates.");
  if (problem === "REVERSED") throw new ToolArgumentError("from must not be after to.");
  if (problem === "TOO_WIDE") {
    throw new ToolArgumentError(
      `That range is longer than ${MAX_RANGE_SPAN_DAYS} days, which analytics does not cover. Ask for a shorter window.`,
    );
  }

  return { from: args.from, to: args.to };
}

/** The shop this session owns, or a refusal. Never a model-supplied value. */
function requireShop(ctx: ToolContext): string {
  if (!ctx.shopId) {
    // Reached only if a tool were mis-scoped in the registry; the route does
    // not build an owner context without a shop. Cheap, and it turns a
    // configuration mistake into a clear error instead of a null shop_id
    // arriving at the database.
    throw new ToolArgumentError("NO_SHOP");
  }
  return ctx.shopId;
}

/**
 * Every RPC returns `setof`, so a one-row aggregate arrives as a one-element
 * array. `null` rather than a fabricated row of zeros — a shop that returned
 * nothing has not said its revenue is 0, and the prompt's rule about 0 versus
 * N/A depends on that difference surviving all the way to the model.
 */
function firstRow<T>(rows: T[] | null): T | null {
  return rows?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// The tools
// ---------------------------------------------------------------------------

/** Shared wiring, so eleven tools do not repeat six lines each. */
function analyticsTool<S extends z.ZodType>(config: {
  name: string;
  description: string;
  schema: S;
  run: (
    args: z.infer<S>,
    ctx: ToolContext,
    scope: { shopId: string; from: string; to: string },
  ) => Promise<unknown>;
}): ToolDefinition<S> {
  return {
    name: config.name,
    description: config.description,
    schema: config.schema,
    // Every tool in this sprint. The loop refuses anything else.
    readOnly: true,
    roles: ["owner"],
    handler: async (args, ctx) => {
      const shopId = requireShop(ctx);
      const { from, to } = resolveRange(args as RangeInput, ctx.now);
      return config.run(args, ctx, { shopId, from, to });
    },
  };
}

export const OWNER_ANALYTICS_TOOLS: readonly ToolDefinition[] = [
  analyticsTool({
    name: "get_overview",
    description:
      "Headline figures for one window: revenue collected, amounts due, completed jobs, unique customers. Start here for 'how is business doing'. Read-only.",
    schema: RangeArgs,
    run: async (_args, ctx, { shopId, from, to }) => {
      const { data, error } = await ctx.supabase.rpc("shop_overview_stats", {
        p_shop_id: shopId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return { range: { from, to }, stats: firstRow(data) };
    },
  }),

  analyticsTool({
    name: "get_revenue_trend",
    description:
      "Revenue over time, bucketed by day or month. Call it twice with different ranges to compare two periods. Read-only.",
    schema: RangeArgs.extend({
      bucket: z
        .enum(["DAY", "MONTH"])
        .describe("DAY for windows up to a couple of months; MONTH for longer."),
    }),
    run: async (args, ctx, { shopId, from, to }) => {
      const { data, error } = await ctx.supabase.rpc("shop_revenue_trend", {
        p_shop_id: shopId,
        p_from: from,
        p_to: to,
        p_bucket: (args as { bucket: "DAY" | "MONTH" }).bucket,
      });
      if (error) throw error;
      return { range: { from, to }, points: data ?? [] };
    },
  }),

  analyticsTool({
    name: "get_appointment_stats",
    description:
      "Parlour appointment counts and outcome rates (completed, cancelled, no-show). Rates are null, not 0, when there were no finished bookings to measure. Read-only.",
    schema: RangeArgs,
    run: async (_args, ctx, { shopId, from, to }) => {
      const { data, error } = await ctx.supabase.rpc("shop_appointment_stats", {
        p_shop_id: shopId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return { range: { from, to }, stats: firstRow(data) };
    },
  }),

  analyticsTool({
    name: "get_queue_stats",
    description:
      "Salon queue figures for the window: serials taken, completed, abandoned, average wait and service time. Read-only.",
    schema: RangeArgs,
    run: async (_args, ctx, { shopId, from, to }) => {
      const { data, error } = await ctx.supabase.rpc("shop_queue_stats", {
        p_shop_id: shopId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return { range: { from, to }, stats: firstRow(data) };
    },
  }),

  analyticsTool({
    name: "get_staff_stats",
    description:
      "Per-chair or per-beautician workload for the window: jobs done, revenue, utilisation against a real rostered denominator. Read-only.",
    schema: RangeArgs,
    run: async (_args, ctx, { shopId, from, to }) => {
      const { data, error } = await ctx.supabase.rpc("shop_staff_stats", {
        p_shop_id: shopId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return { range: { from, to }, staff: data ?? [] };
    },
  }),

  analyticsTool({
    name: "get_peak_slots",
    description:
      "Which hours of which weekdays were busiest in the window. This is a DESCRIPTION of what already happened, not a forecast — never present it as a prediction. Read-only.",
    schema: RangeArgs,
    run: async (_args, ctx, { shopId, from, to }) => {
      const { data, error } = await ctx.supabase.rpc("shop_peak_slots", {
        p_shop_id: shopId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return { range: { from, to }, slots: data ?? [] };
    },
  }),

  analyticsTool({
    name: "get_loyalty_stats",
    description:
      "Loyalty programme figures for the window: points awarded and spent, and how many customers hold a balance. Points come from the ledger — never recompute them from bills. Read-only.",
    schema: RangeArgs,
    run: async (_args, ctx, { shopId, from, to }) => {
      const { data, error } = await ctx.supabase.rpc("shop_loyalty_stats", {
        p_shop_id: shopId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return { range: { from, to }, stats: firstRow(data) };
    },
  }),

  analyticsTool({
    name: "get_membership_stats",
    description:
      "Memberships sold and active in the window. There is no auto-renewal and no recurring billing in this product, so never project monthly membership income from it. Read-only.",
    schema: RangeArgs,
    run: async (_args, ctx, { shopId, from, to }) => {
      const { data, error } = await ctx.supabase.rpc("shop_membership_stats", {
        p_shop_id: shopId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return { range: { from, to }, stats: firstRow(data) };
    },
  }),

  analyticsTool({
    name: "get_referral_summary",
    description:
      "Referral figures for the window. A referral counts as CONVERTED only once the referred customer actually completed a job — a claimed code is not a conversion. Read-only.",
    schema: RangeArgs,
    run: async (_args, ctx, { shopId, from, to }) => {
      const { data, error } = await ctx.supabase.rpc("shop_referral_summary", {
        p_shop_id: shopId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return { range: { from, to }, stats: firstRow(data) };
    },
  }),

  analyticsTool({
    name: "get_reward_stats",
    description:
      "Reward redemptions in the window and the discount they cost. Those discounts are already deducted from the revenue figures elsewhere — do not subtract them again. Read-only.",
    schema: RangeArgs,
    run: async (_args, ctx, { shopId, from, to }) => {
      const { data, error } = await ctx.supabase.rpc("shop_reward_stats", {
        p_shop_id: shopId,
        p_from: from,
        p_to: to,
      });
      if (error) throw error;
      return { range: { from, to }, stats: firstRow(data) };
    },
  }),

  analyticsTool({
    name: "get_analytics_breakdown",
    description:
      "Revenue and volume split by one dimension: SERVICE (which services sell), PAYMENT_METHOD, MEMBERSHIP_TIER or REWARD. Use SERVICE for 'which service is most popular'. Read-only.",
    schema: RangeArgs.extend({
      dimension: z
        .enum(["SERVICE", "PAYMENT_METHOD", "MEMBERSHIP_TIER", "REWARD"])
        .describe("What to split by."),
    }),
    run: async (args, ctx, { shopId, from, to }) => {
      const { data, error } = await ctx.supabase.rpc("shop_analytics_breakdown", {
        p_shop_id: shopId,
        p_from: from,
        p_to: to,
        p_dimension: (args as { dimension: "SERVICE" | "PAYMENT_METHOD" | "MEMBERSHIP_TIER" | "REWARD" })
          .dimension,
      });
      if (error) throw error;
      return { range: { from, to }, dimension: (args as { dimension: string }).dimension, rows: data ?? [] };
    },
  }),
];

/**
 * Today in Dhaka, for the system prompt.
 *
 * Without it the model has no idea what "this week" means and reaches for its
 * training cutoff instead.
 *
 * Shifted then read through `toISOString()`, which is UTC-based — NOT through
 * `ymd()`, whose getters are local. On this project's UTC servers the two
 * agree, but on a contributor's machine in another zone `ymd()` would apply
 * the offset twice and hand the model the wrong day. This is the same two
 * lines `gatherShopBrief()` already uses, and the +6 is the project's existing
 * fixed convention: Bangladesh has observed no DST since 2010, so a fixed
 * offset is the whole truth here.
 */
export function dhakaToday(now: Date): string {
  return new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
