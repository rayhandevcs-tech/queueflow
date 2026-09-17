import "server-only";
import { z } from "zod";
import {
  DEFAULT_LOOKBACK_DAYS,
  MAX_CAMPAIGN_RECIPIENTS,
  MAX_LOOKBACK_DAYS,
  MIN_CAMPAIGN_RECIPIENTS,
  MIN_LOOKBACK_DAYS,
  MIN_SHOP_VISITS_FOR_SEGMENTS,
  SEGMENTS,
  SEGMENT_KEYS,
  audienceProblem,
  isSegmentKey,
  lookbackProblem,
  sinceDate,
  type SegmentKey,
} from "@/lib/segments";
import {
  CAMPAIGN_BODY_MAX,
  CAMPAIGN_TITLE_MAX,
  NO_OFFER_FACTS,
  campaignShapeProblem,
  checkDraftedCampaign,
  type ShopOfferFacts,
} from "@/lib/campaign-content";
import type { DiscoveryLedgerLike, ToolContext, ToolDefinition } from "../types";
import {
  AI_ACTION_SEND_CAMPAIGN,
  ProposalError,
  type CampaignDraft,
} from "../proposals";

/**
 * The owner's retention tools: three to look, two to prepare.
 *
 * ---------------------------------------------------------------------------
 * Not one customer is selected in this file
 * ---------------------------------------------------------------------------
 * Every segment below is decided by `shop_segment_rows()` in SQL, behind
 * `is_shop_owner()`. These tools validate arguments, call an RPC and shape the
 * result. That is the brief's central rule — "DO NOT let the LLM decide raw
 * membership of a segment" — and the way to keep it is for there to be no code
 * here that could.
 *
 * The division of labour, stated once:
 *
 *   the MODEL chooses    which segment (from the six it was offered),
 *                        how far back to look (within bounds),
 *                        and the words
 *   the SERVER decides   which shop, who is in the segment, how many that is,
 *                        whether it may be sent, and what actually goes out
 *
 * ---------------------------------------------------------------------------
 * The shop is never a parameter
 * ---------------------------------------------------------------------------
 * No tool here takes a `shop_id`, `owner_id` or customer id, and there is no
 * argument through which the model could supply one. `ctx.shopId` was resolved
 * from `auth.getUser()` before the model had spoken; the RPC re-checks
 * ownership; and `ai_action_propose` checks it a third time when the proposal
 * is written. §4's "never allow the model to supply arbitrary shop_id" is
 * enforced by absence, which is stronger than by validation.
 *
 * ---------------------------------------------------------------------------
 * And no customer id is returned
 * ---------------------------------------------------------------------------
 * `get_segment_customers` gives back display names, last-visit dates and visit
 * counts. No id, no phone, no email, no address, no notification preference.
 *
 * That is §5's minimum-data rule taken literally, and it costs nothing: nothing
 * downstream accepts a customer id from a caller, so a uuid in the model's
 * context would be risk with no use. It also makes two of the brief's security
 * tests true by construction rather than by checking — a forged customer id
 * cannot be queried and an invented one cannot be used, because there is
 * nowhere to put one.
 *
 * The recipient snapshot does contain ids, and it never passes through here:
 * `shop_campaign_recipients()` returns it to the route, which stores it on the
 * proposal. The model is told a count.
 *
 * ---------------------------------------------------------------------------
 * `readOnly: true` on a tool called `prepare_campaign_send`
 * ---------------------------------------------------------------------------
 * Because it writes nothing and sends nothing. It reads the segment, freezes
 * the audience, checks the words against the shop's own configured offers, and
 * leaves a draft in the ledger. The PROPOSED row is written by the route after
 * the loop; the send happens in `/api/ai/actions/confirm` after the owner
 * presses a button, in a request with no model in it. The agent loop still
 * refuses `readOnly: false`, unchanged since Sprint 1.
 */

/** A sample, not a directory. The true count travels alongside it. */
const MAX_LISTED_CUSTOMERS = 20;

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------

/** The shop this session owns, or a refusal. Never a model-supplied value. */
function requireShop(ctx: ToolContext): string {
  if (!ctx.shopId) {
    // Reached only if a tool were mis-scoped in the registry; the route does
    // not build an owner context without a shop. It turns a configuration
    // mistake into a clear refusal instead of a null shop id arriving at the
    // database.
    throw new ProposalError("NOT_SHOP_OWNER");
  }
  return ctx.shopId;
}

/** The window, validated, or a refusal with the reason. */
function resolveWindow(
  ctx: ToolContext,
  days: number | undefined,
): { lookbackDays: number; since: string } {
  const lookbackDays = days ?? DEFAULT_LOOKBACK_DAYS;
  if (lookbackProblem(lookbackDays)) {
    throw new ProposalError("WINDOW_INVALID");
  }
  return { lookbackDays, since: sinceDate(ctx.now, lookbackDays) };
}

/** One of the six, or a refusal. Checked before any query. */
function requireKnownSegment(segment: string): SegmentKey {
  if (!isSegmentKey(segment)) throw new ProposalError("SEGMENT_UNKNOWN");
  return segment;
}

/**
 * Postgres's refusals from the segment functions → this layer's vocabulary.
 *
 * `not your shop` is `analytics_scope`'s and `is_shop_owner`'s shared phrase,
 * already used by the eleven analytics tools. Anything unrecognised becomes
 * UNAVAILABLE rather than being echoed, so a constraint name cannot reach an
 * owner or the model.
 */
function segmentRefusal(error: unknown): ProposalError {
  const raw =
    error instanceof Error
      ? error.message
      : String((error as { message?: string })?.message ?? error ?? "");
  if (raw.includes("not your shop")) return new ProposalError("NOT_SHOP_OWNER");
  if (raw.includes("segment_window")) return new ProposalError("WINDOW_INVALID");
  if (raw.includes("segment_limit_out_of_range")) {
    return new ProposalError("WINDOW_INVALID");
  }
  return new ProposalError("UNAVAILABLE");
}

/**
 * How many completed visits this shop has on record at all.
 *
 * §24's minimum-data guard needs a denominator, and the summary's own counts
 * cannot provide one: a shop with three customers who each came twice has
 * three REGULARS and six visits, which looks like a segment and is a sample.
 *
 * Counted across both halves of the product, because a UNISEX shop runs a queue
 * and an appointment book at once. Under the owner's own read policies — this
 * is a `head: true` count, so no row is fetched.
 */
async function countCompletedVisits(
  ctx: ToolContext,
  shopId: string,
): Promise<number> {
  const [serials, appointments] = await Promise.all([
    ctx.supabase
      .from("serials")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("status", "DONE")
      .not("customer_id", "is", null),
    ctx.supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("status", "DONE")
      .not("customer_id", "is", null),
  ]);

  return (serials.count ?? 0) + (appointments.count ?? 0);
}

/**
 * What this shop has actually configured, for the invented-offer guard.
 *
 * Three reads, all of the owner's own rows. A failure yields the EMPTY fact
 * set rather than being swallowed, and that direction is deliberate: with no
 * facts, every numeric claim is unverified and the draft is refused. Failing
 * closed here means a transient read error cannot let an invented discount
 * through, and the owner is told to try again rather than handed a promise
 * nobody checked.
 */
async function readOfferFacts(
  ctx: ToolContext,
  shopId: string,
): Promise<ShopOfferFacts> {
  const nowIso = ctx.now.toISOString();

  const [offers, rewards, services] = await Promise.all([
    ctx.supabase
      .from("offers")
      .select("discount_pct, valid_until, active")
      .eq("shop_id", shopId)
      .eq("active", true),
    ctx.supabase
      .from("rewards")
      .select("kind, value, is_active, valid_until")
      .eq("shop_id", shopId)
      .eq("is_active", true),
    ctx.supabase
      .from("services")
      .select("rate, is_active")
      .eq("shop_id", shopId)
      .eq("is_active", true),
  ]);

  if (offers.error || rewards.error || services.error) return NO_OFFER_FACTS;

  const discountPcts: number[] = [];
  const flatDiscounts: number[] = [];
  const servicePrices: number[] = [];
  let hasFreeServiceReward = false;

  for (const offer of offers.data ?? []) {
    // An expired offer is not a fact the shop can honour today.
    if (offer.valid_until && offer.valid_until < nowIso.slice(0, 10)) continue;
    if (Number.isFinite(offer.discount_pct)) discountPcts.push(offer.discount_pct);
  }

  for (const reward of rewards.data ?? []) {
    if (reward.valid_until && reward.valid_until < nowIso) continue;
    if (reward.kind === "DISCOUNT_PCT" && reward.value !== null) {
      discountPcts.push(reward.value);
    }
    if (reward.kind === "DISCOUNT_FLAT" && reward.value !== null) {
      flatDiscounts.push(reward.value);
    }
    if (reward.kind === "FREE_SERVICE") hasFreeServiceReward = true;
  }

  for (const service of services.data ?? []) {
    if (Number.isFinite(service.rate)) servicePrices.push(service.rate);
  }

  return { discountPcts, flatDiscounts, servicePrices, hasFreeServiceReward };
}

// ---------------------------------------------------------------------------
// 1) get_customer_segments
// ---------------------------------------------------------------------------

const SegmentsArgs = z.object({
  lookbackDays: z
    .number()
    .int()
    .min(MIN_LOOKBACK_DAYS)
    .max(MAX_LOOKBACK_DAYS)
    .optional()
    .describe(
      `How far back "recently" means, in days. Default ${DEFAULT_LOOKBACK_DAYS}. ` +
        `Allowed ${MIN_LOOKBACK_DAYS}-${MAX_LOOKBACK_DAYS}. The server resolves it to a calendar day in the shop's own timezone.`,
    ),
});

const getCustomerSegments: ToolDefinition<typeof SegmentsArgs> = {
  name: "get_customer_segments",
  description:
    "All six customer segments for the owner's OWN shop, with how many customers are in each and how many of those can receive a promotional notification. " +
    "Start here for 'who are my regulars', 'who has not come back', 'who should I be paying attention to'. " +
    "Every segment is a deterministic rule over completed visits, memberships and points — it is never a prediction and there is no churn score. Read-only.",
  readOnly: true,
  roles: ["owner"],
  schema: SegmentsArgs,
  handler: async (args, ctx) => {
    const shopId = requireShop(ctx);
    const { lookbackDays, since } = resolveWindow(ctx, args.lookbackDays);

    // §24's guard, first. A shop below the floor is told so rather than shown
    // six counts derived from four haircuts.
    const totalVisits = await countCompletedVisits(ctx, shopId);
    if (totalVisits < MIN_SHOP_VISITS_FOR_SEGMENTS) {
      return {
        segments: [],
        enough_data: false,
        completed_visits_on_record: totalVisits,
        note:
          `This shop has only ${totalVisits} completed visits on record, which is fewer than the ${MIN_SHOP_VISITS_FOR_SEGMENTS} needed to describe a segment honestly. ` +
          "Say that plainly. Do NOT name a segment, do NOT give a count, and do NOT suggest a campaign — there is not enough history to know who anybody is yet.",
      };
    }

    const { data, error } = await ctx.supabase.rpc("shop_segment_summary", {
      p_shop_id: shopId,
      p_since: since,
    });
    if (error) throw segmentRefusal(error);

    const rows = data ?? [];
    const segments = SEGMENT_KEYS.map((key) => {
      const row = rows.find((r) => r.segment === key);
      const definition = SEGMENTS[key];
      return {
        segment: key,
        label: definition.labelBn,
        rule: definition.rule,
        reason: definition.reasonBn(lookbackDays),
        uses_window: definition.usesWindow,
        customer_count: row?.member_count ?? 0,
        // The count that matters for a campaign, named so it cannot be
        // confused with the segment size in the model's context.
        can_receive_promotions: row?.reachable_count ?? 0,
        oldest_last_visit: row?.oldest_last_visit ?? null,
        newest_last_visit: row?.newest_last_visit ?? null,
        // Said out loud rather than left for the model to discover by getting
        // a refusal: a segment below the floor cannot be campaigned to.
        can_send_campaign:
          audienceProblem(row?.reachable_count ?? 0) === null,
      };
    });

    // The ONLY way a segment key becomes proposable. `prepare_campaign` checks
    // against this ledger before it queries anything, so a segment the model
    // invented, remembered from an earlier turn, or read out of a customer's
    // name cannot reach the campaign path.
    ctx.discovery?.offer("segment", SEGMENT_KEYS as readonly string[]);

    return {
      segments,
      enough_data: true,
      completed_visits_on_record: totalVisits,
      window: { lookback_days: lookbackDays, since },
      note:
        "These counts are facts about completed visits, memberships and points — not forecasts. " +
        "Never say a customer 'will' stop coming, never give a churn probability, and never call the LAPSED group 'churned'. " +
        `A campaign needs at least ${MIN_CAMPAIGN_RECIPIENTS} people who can receive promotions and at most ${MAX_CAMPAIGN_RECIPIENTS}. ` +
        "You cannot send anything: to offer the owner a campaign, call prepare_campaign and then prepare_campaign_send.",
    };
  },
};

// ---------------------------------------------------------------------------
// 2) get_segment_customers
// ---------------------------------------------------------------------------

const SegmentCustomersArgs = z.object({
  segment: z
    .enum(SEGMENT_KEYS)
    .describe(
      "Which segment, from a get_customer_segments result in THIS turn. A name you were not given will be rejected.",
    ),
  lookbackDays: z
    .number()
    .int()
    .min(MIN_LOOKBACK_DAYS)
    .max(MAX_LOOKBACK_DAYS)
    .optional()
    .describe("Must match the window you used for get_customer_segments."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LISTED_CUSTOMERS)
    .optional()
    .describe(`How many to list. Default and maximum ${MAX_LISTED_CUSTOMERS}.`),
});

const getSegmentCustomers: ToolDefinition<typeof SegmentCustomersArgs> = {
  name: "get_segment_customers",
  description:
    "The customers in one verified segment of the owner's OWN shop, by name, with their last visit and how many times they came. " +
    "Use for 'who are my regulars', 'name the people who have not come back'. " +
    "Returns a sample with the true total alongside it — never the whole list. It does not return phone numbers, and there is no way to ask for one. Read-only.",
  readOnly: true,
  roles: ["owner"],
  schema: SegmentCustomersArgs,
  handler: async (args, ctx) => {
    const shopId = requireShop(ctx);
    const ledger = ctx.discovery as DiscoveryLedgerLike | undefined;
    // BEFORE any query: was this segment actually offered this request? The
    // zod enum already limits it to the six, so this second gate is about
    // ORDER — the model must have looked before it names a group, so that the
    // count it goes on to quote came from the same window.
    ledger?.requireOffered("segment", [args.segment]);

    const segment = requireKnownSegment(args.segment);
    const { lookbackDays, since } = resolveWindow(ctx, args.lookbackDays);
    const limit = args.limit ?? MAX_LISTED_CUSTOMERS;

    const [members, summary] = await Promise.all([
      ctx.supabase.rpc("shop_segment_members", {
        p_shop_id: shopId,
        p_segment: segment,
        p_since: since,
        p_limit: limit,
      }),
      ctx.supabase.rpc("shop_segment_summary", {
        p_shop_id: shopId,
        p_since: since,
      }),
    ]);

    if (members.error) throw segmentRefusal(members.error);
    if (summary.error) throw segmentRefusal(summary.error);

    const total =
      (summary.data ?? []).find((r) => r.segment === segment)?.member_count ?? 0;
    const listed = members.data ?? [];

    return {
      segment,
      label: SEGMENTS[segment].labelBn,
      reason: SEGMENTS[segment].reasonBn(lookbackDays),
      window: { lookback_days: lookbackDays, since },
      customer_count: total,
      listed: listed.length,
      customers: listed.map((row) => ({
        name: row.display_name,
        last_visit_at: row.last_visit_at,
        visits_in_window: row.visit_count,
      })),
      note:
        (listed.length < total
          ? `Showing ${listed.length} of ${total}. Say the total, and say you are naming some of them. `
          : "") +
        "These names are the shop's own records. There is no phone number, email or address here and you cannot ask for one. " +
        "Do not describe any of these people as likely to leave — the rule is about visits that happened, nothing more.",
    };
  },
};

// ---------------------------------------------------------------------------
// 3) get_segment_insights
// ---------------------------------------------------------------------------

const InsightsArgs = z.object({
  segment: z
    .enum(SEGMENT_KEYS)
    .describe("Which segment, from a get_customer_segments result in THIS turn."),
  lookbackDays: z
    .number()
    .int()
    .min(MIN_LOOKBACK_DAYS)
    .max(MAX_LOOKBACK_DAYS)
    .optional()
    .describe("Must match the window you used for get_customer_segments."),
});

const getSegmentInsights: ToolDefinition<typeof InsightsArgs> = {
  name: "get_segment_insights",
  description:
    "Aggregate figures for one verified segment: how many, how many can receive promotions, when they last came (bucketed), average visits, and how many hold a membership, points or a converted referral. " +
    "Use this to explain WHY a segment is worth attention before drafting anything. " +
    "Counts and dates only — no individual rows, no rates, no projections. A null average means the segment is empty, not zero. Read-only.",
  readOnly: true,
  roles: ["owner"],
  schema: InsightsArgs,
  handler: async (args, ctx) => {
    const shopId = requireShop(ctx);
    const ledger = ctx.discovery as DiscoveryLedgerLike | undefined;
    ledger?.requireOffered("segment", [args.segment]);

    const segment = requireKnownSegment(args.segment);
    const { lookbackDays, since } = resolveWindow(ctx, args.lookbackDays);

    const { data, error } = await ctx.supabase.rpc("shop_segment_insights", {
      p_shop_id: shopId,
      p_segment: segment,
      p_since: since,
    });
    if (error) throw segmentRefusal(error);

    const row = (data ?? [])[0] ?? null;
    if (!row || row.member_count === 0) {
      return {
        segment,
        window: { lookback_days: lookbackDays, since },
        customer_count: 0,
        note:
          "Nobody is in this segment for that window. Say so. Do not suggest a campaign to an empty group, and do not widen the window on your own to find somebody — ask the owner first.",
      };
    }

    return {
      segment,
      label: SEGMENTS[segment].labelBn,
      rule: SEGMENTS[segment].rule,
      reason: SEGMENTS[segment].reasonBn(lookbackDays),
      window: { lookback_days: lookbackDays, since },
      customer_count: row.member_count,
      can_receive_promotions: row.reachable_count,
      muted_promotions: row.muted_count,
      never_completed_a_visit: row.never_visited,
      last_visit: {
        oldest: row.oldest_last_visit,
        newest: row.newest_last_visit,
        within_30_days: row.visited_last_30,
        between_31_and_90_days: row.visited_31_90,
        over_90_days: row.visited_91_plus,
      },
      /** Null for an empty segment, never 0 — the project's standing rule. */
      avg_visits_in_window: row.avg_visits,
      holding_active_membership: row.active_members,
      holding_points_at_this_shop: row.with_points,
      referred_somebody_who_converted: row.referred_someone,
      note:
        "Every number here is a count over this shop's own rows. " +
        "You may say this group looks worth re-engaging — that is an observation. You may NOT say they are likely to leave, give a probability, or call it churn. " +
        "A null average means the segment is empty, not that it is zero.",
    };
  },
};

// ---------------------------------------------------------------------------
// 4) prepare_campaign — the draft, checked against the shop's real offers
// ---------------------------------------------------------------------------

const PrepareCampaignArgs = z.object({
  segment: z
    .enum(SEGMENT_KEYS)
    .describe("Which verified segment, from a get_customer_segments result in THIS turn."),
  lookbackDays: z
    .number()
    .int()
    .min(MIN_LOOKBACK_DAYS)
    .max(MAX_LOOKBACK_DAYS)
    .optional()
    .describe("Must match the window you used for get_customer_segments."),
  title: z
    .string()
    .min(1)
    .max(CAMPAIGN_TITLE_MAX)
    .describe(
      `The notification headline, in Bangla, at most ${CAMPAIGN_TITLE_MAX} characters.`,
    ),
  body: z
    .string()
    .min(1)
    .max(CAMPAIGN_BODY_MAX)
    .describe(
      `The message, in Bangla, at most ${CAMPAIGN_BODY_MAX} characters. ` +
        "Do NOT put a discount, a price, a free service or an expiry date in it unless the shop has that configured — the server checks, and an unconfigured figure is rejected.",
    ),
});

/**
 * Check the drafted words and freeze the audience.
 *
 * Shared with the confirm endpoint's revalidation, which is the point: the send
 * recomputes the snapshot through the same function with the same arguments, so
 * a difference between the two is a real change in the shop's customers rather
 * than a difference in how the question was asked.
 */
export async function buildCampaignDraft(
  ctx: ToolContext,
  input: {
    shopId: string;
    segment: SegmentKey;
    lookbackDays: number;
    since: string;
    title: string;
    body: string;
    /**
     * Whether the words are the MODEL's or the OWNER's.
     *
     * §9's distinction, and the only place it is expressed. Model-drafted text
     * is checked against the shop's configured offers; an owner's own text is
     * not, because the owner IS the business and may promise a discount they
     * have not yet entered into the app. A system that refused them would be
     * wrong about who is in charge.
     */
    authored: "model" | "owner";
  },
): Promise<{ draft: CampaignDraft; recipients: string[] }> {
  const { data: shop, error: shopError } = await ctx.supabase
    .from("shops")
    .select("id, name, owner_id")
    .eq("id", input.shopId)
    .maybeSingle();

  if (shopError) throw new ProposalError("UNAVAILABLE");
  if (!shop) throw new ProposalError("SHOP_NOT_FOUND");
  // The ownership check in this layer. `shop_campaign_recipients`,
  // `ai_action_propose` and `broadcast_campaign` each make it again in SQL —
  // this one exists so the refusal has a name before a Postgres exception does.
  if (shop.owner_id !== ctx.userId) throw new ProposalError("NOT_SHOP_OWNER");

  // The words, before the audience. A draft that cannot be sent should not
  // cost a segment computation.
  if (input.authored === "model") {
    const facts = await readOfferFacts(ctx, input.shopId);
    const verdict = checkDraftedCampaign({
      title: input.title,
      body: input.body,
      facts,
    });
    if (!verdict.ok) {
      throw new ProposalError(
        verdict.problem === "INVENTED_OFFER"
          ? "CAMPAIGN_INVENTS_OFFER"
          : "CAMPAIGN_CONTENT_INVALID",
      );
    }
  } else if (campaignShapeProblem(input.title, input.body)) {
    // The owner's own text has to fit in a notification, and that is ALL it
    // has to do. `campaignShapeProblem` rather than `checkDraftedCampaign`:
    // shape and length, with no offer check, because the owner is the business
    // and may promise a discount they have not yet entered into the app.
    throw new ProposalError("CAMPAIGN_CONTENT_INVALID");
  }

  // The audience, from the database. The ONLY place a recipient list is
  // produced, and it never enters the model's context.
  const { data: recipientRows, error: recipientError } = await ctx.supabase.rpc(
    "shop_campaign_recipients",
    { p_shop_id: input.shopId, p_segment: input.segment, p_since: input.since },
  );
  if (recipientError) throw segmentRefusal(recipientError);

  const recipients = (recipientRows ?? []) as unknown as string[];

  const problem = audienceProblem(recipients.length);
  if (problem === "TOO_SMALL") {
    throw new ProposalError(
      recipients.length === 0 ? "SEGMENT_EMPTY" : "SEGMENT_TOO_SMALL",
    );
  }
  if (problem === "TOO_LARGE") throw new ProposalError("SEGMENT_TOO_LARGE");

  // How many are in the segment but muted, so the card can say so rather than
  // quietly showing a smaller number than the owner expected.
  const { data: insightRows } = await ctx.supabase.rpc("shop_segment_insights", {
    p_shop_id: input.shopId,
    p_segment: input.segment,
    p_since: input.since,
  });
  const mutedCount = (insightRows ?? [])[0]?.muted_count ?? 0;

  return {
    recipients,
    draft: {
      action: AI_ACTION_SEND_CAMPAIGN,
      shopId: shop.id,
      shopName: shop.name,
      segment: input.segment,
      segmentLabel: SEGMENTS[input.segment].labelBn,
      reason: SEGMENTS[input.segment].reasonBn(input.lookbackDays),
      lookbackDays: input.lookbackDays,
      since: input.since,
      // The length of the array the DATABASE returned. §12: "Do not rely on
      // the model's displayed recipient count."
      recipientCount: recipients.length,
      mutedCount,
      title: input.title.trim(),
      body: input.body.trim(),
    },
  };
}

const prepareCampaign: ToolDefinition<typeof PrepareCampaignArgs> = {
  name: "prepare_campaign",
  description:
    "Draft a campaign for one verified segment and check it. This does NOT send anything and does NOT create anything the owner can approve yet — it tells you how many people would receive it and whether the wording is allowed. " +
    "Call get_customer_segments first in this same turn. " +
    "The server rejects any discount, price, free service or figure the shop has not actually configured, so write about the shop, not about an offer you invented. Read-only.",
  readOnly: true,
  roles: ["owner"],
  schema: PrepareCampaignArgs,
  handler: async (args, ctx) => {
    const shopId = requireShop(ctx);
    const ledger = ctx.discovery as DiscoveryLedgerLike | undefined;
    if (!ledger) throw new ProposalError("SEGMENT_NOT_OFFERED");
    ledger.requireOffered("segment", [args.segment]);

    const segment = requireKnownSegment(args.segment);
    const { lookbackDays, since } = resolveWindow(ctx, args.lookbackDays);

    const { draft } = await buildCampaignDraft(ctx, {
      shopId,
      segment,
      lookbackDays,
      since,
      title: args.title,
      body: args.body,
      authored: "model",
    });

    // Deliberately NOT left in `ledger.draft`. This tool checks a draft; it
    // does not offer one. The owner gets a card only from
    // `prepare_campaign_send`, so "the assistant wrote something" and "the
    // owner has a button" stay two separate steps — which is what lets the
    // model show a draft, be told to shorten it, and show another, without a
    // stale approval card sitting under the conversation.
    return {
      checked: true,
      segment,
      label: draft.segmentLabel,
      reason: draft.reason,
      window: { lookback_days: lookbackDays, since },
      would_reach: draft.recipientCount,
      muted_promotions: draft.mutedCount,
      title: draft.title,
      body: draft.body,
      note:
        "NOTHING HAS BEEN SENT and the owner has no approval card yet. " +
        "Show them the message and the recipient count and ask whether to set it up for approval. " +
        "If they want it changed, call prepare_campaign again with the new wording. " +
        "When they are happy, call prepare_campaign_send — that is what produces the card. Even then you are not sending it: they press the button.",
    };
  },
};

// ---------------------------------------------------------------------------
// 5) prepare_campaign_send — the approval card
// ---------------------------------------------------------------------------

const prepareCampaignSend: ToolDefinition<typeof PrepareCampaignArgs> = {
  name: "prepare_campaign_send",
  description:
    "Produce the approval card for a campaign the owner has agreed to. This does NOT send anything: it freezes exactly who would receive the message and shows the owner a card with Edit, Cancel and Approve & Send on it. " +
    "Only the owner pressing Approve & Send can deliver a campaign — you cannot, in this turn or any other. " +
    "After calling this, tell them what the card says and that they need to approve it. Never say the campaign has been sent, and never say how many people received it.",
  readOnly: true,
  roles: ["owner"],
  schema: PrepareCampaignArgs,
  handler: async (args, ctx) => {
    const shopId = requireShop(ctx);
    const ledger = ctx.discovery as DiscoveryLedgerLike | undefined;
    if (!ledger) throw new ProposalError("SEGMENT_NOT_OFFERED");
    ledger.requireOffered("segment", [args.segment]);

    const segment = requireKnownSegment(args.segment);
    const { lookbackDays, since } = resolveWindow(ctx, args.lookbackDays);

    const { draft, recipients } = await buildCampaignDraft(ctx, {
      shopId,
      segment,
      lookbackDays,
      since,
      title: args.title,
      body: args.body,
      authored: "model",
    });

    // The draft AND the snapshot go to the ledger. The route reads both after
    // the loop and writes the PROPOSED row; the recipient ids are not in the
    // returned payload below, so they never enter the model's context.
    ledger.draft = draft;
    ledger.campaignRecipients = recipients;

    return {
      prepared: true,
      segment,
      label: draft.segmentLabel,
      reason: draft.reason,
      recipient_count: draft.recipientCount,
      muted_promotions: draft.mutedCount,
      title: draft.title,
      body: draft.body,
      note:
        "NOTHING HAS BEEN SENT. An approval card is now shown to the owner with the message, the group and the number of people on it. " +
        "They must press Approve & Send themselves, and they may edit the wording first — if they do, the edited text is what goes out. " +
        "Tell them what the card says and ask them to check it. Do not claim the campaign is sent, do not say anybody has received it, and do not give a delivery count.",
    };
  },
};

export const RETENTION_TOOLS: readonly ToolDefinition[] = [
  getCustomerSegments,
  getSegmentCustomers,
  getSegmentInsights,
  prepareCampaign,
  prepareCampaignSend,
];
