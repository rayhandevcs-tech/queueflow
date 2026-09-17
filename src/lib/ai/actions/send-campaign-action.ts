import "server-only";
import { isSegmentKey, sameAudience } from "@/lib/segments";
import { campaignShapeProblem } from "@/lib/campaign-content";
import type { ToolContext } from "../types";
import { AI_ACTION_SEND_CAMPAIGN, ProposalError } from "../proposals";
import type { ActionExecutor, ActionOutcome, ConfirmedAction } from "./contract";

/**
 * SEND_CAMPAIGN — revalidate everything, then call the app's own broadcast.
 *
 * ---------------------------------------------------------------------------
 * The one action whose effect lands on other people
 * ---------------------------------------------------------------------------
 * A queue join, a booking and a redemption all affect the person who confirmed
 * them. A campaign puts a notification on forty-three other phones, and it
 * cannot be taken back. That asymmetry is why this executor revalidates more
 * than the other three do, and why every one of those checks is also made
 * again in SQL: the brief's hard requirement is that there be "no hidden
 * auto-send path", and the way to be sure of that is for the send to be
 * impossible without an approval row, not merely for no caller to attempt it.
 *
 * ---------------------------------------------------------------------------
 * What is revalidated here, in order, and why each one is here
 * ---------------------------------------------------------------------------
 *   1. the action's SHAPE — a campaign row without a segment, a snapshot or
 *      content is not half a campaign, it is a row nothing can be checked
 *      against;
 *   2. SHOP OWNERSHIP — read from `shops.owner_id` against the session's user
 *      id. The confirm route does not resolve the caller's shop, so this
 *      executor does it; `broadcast_campaign` asks `is_shop_owner()` again;
 *   3. the SEGMENT is one of the six — a stored key outside the vocabulary
 *      means the row predates a change, and the audience cannot be recomputed;
 *   4. the CONTENT is present and fits — the owner's edit has already been
 *      applied by the route at this point, so this is checking what will
 *      actually be sent;
 *   5. the AUDIENCE has not moved — `shop_campaign_recipients()` is called
 *      again with the SAME segment and the SAME stored cutoff date, and the
 *      result is compared to the snapshot. This is §15's SEGMENT_CHANGED, and
 *      the paragraph below is why it is strict.
 *
 * ---------------------------------------------------------------------------
 * Why SEGMENT_CHANGED is strict rather than tolerant
 * ---------------------------------------------------------------------------
 * The comparison is exact set equality. One person more or fewer and the send
 * is refused.
 *
 * That could look like excessive caution, so the concrete case: the owner
 * approves "42 customers who have not been in for two months". While they were
 * reading it, one of those customers walked in and had a haircut. Sending to
 * the stored list now tells somebody who was in the shop an hour ago that they
 * have not been seen in a while. That is the specific embarrassment this guard
 * exists to prevent, and a tolerance of "one or two" would let exactly it
 * through.
 *
 * The cost is that a busy shop may have to ask again, and the recovery is one
 * question — the assistant recomputes and shows a fresh card. The stored cutoff
 * is a DATE rather than an instant precisely so that the clock ticking cannot
 * cause this: only real customer activity can, which is what the refusal then
 * honestly means.
 *
 * ---------------------------------------------------------------------------
 * And why this file does not decide who receives anything
 * ---------------------------------------------------------------------------
 * `broadcast_campaign()` re-derives nothing and trusts nothing: it reads the
 * snapshot off the row, checks that the row is a CONFIRMED SEND_CAMPAIGN owned
 * by the caller for that shop, checks the title and body match the row's own,
 * checks every recipient is genuinely that shop's customer, applies the
 * existing daily budget, and inserts through the existing per-user PROMO
 * opt-out. If every line of this file were wrong, the wrong campaign would
 * still be refused.
 */

/** Map `broadcast_campaign`'s refusals onto this layer's vocabulary. */
function campaignRefusal(error: unknown): ProposalError {
  const raw =
    error instanceof Error
      ? error.message
      : String((error as { message?: string })?.message ?? error ?? "");

  // The one that will actually happen in practice: the shop already sent a
  // promotional notification today, whether through the assistant or through
  // the manual "নোটিফিকেশন পাঠান" screen. A shared budget is the point (§25),
  // so this is the limit working rather than a failure.
  if (raw.includes("campaign_daily_limit")) {
    return new ProposalError("BROADCAST_LIMIT_REACHED");
  }
  // Somebody in the snapshot is not this shop's customer. Unreachable through
  // the normal path — the snapshot came from the shop's own segment query —
  // which is exactly why it is worth its own code: reaching it means something
  // upstream is wrong, and the audit should say so rather than record a
  // generic refusal.
  if (raw.includes("campaign_recipient_not_a_customer")) {
    return new ProposalError("RECIPIENT_NOT_A_CUSTOMER");
  }
  if (raw.includes("not your shop") || raw.includes("campaign_wrong_shop")) {
    return new ProposalError("NOT_SHOP_OWNER");
  }
  if (
    raw.includes("campaign_not_confirmed") ||
    raw.includes("campaign_action_not_found")
  ) {
    return new ProposalError("NOT_FOUND");
  }
  if (
    raw.includes("campaign_content_mismatch") ||
    raw.includes("campaign_content_required")
  ) {
    return new ProposalError("CAMPAIGN_CONTENT_INVALID");
  }
  if (
    raw.includes("campaign_no_recipients") ||
    raw.includes("campaign_too_many_recipients")
  ) {
    return new ProposalError("SEGMENT_CHANGED");
  }
  return new ProposalError("CAMPAIGN_REFUSED");
}

export const sendCampaignExecutor: ActionExecutor = {
  actionType: AI_ACTION_SEND_CAMPAIGN,

  async execute(ctx: ToolContext, action: ConfirmedAction): Promise<ActionOutcome> {
    // 1) The shape. All five parameters travel together — the table's
    //    `ai_actions_params_match_type` guarantees it — so any one being
    //    missing means the row is not a campaign this code can check.
    const { campaignSegment, campaignSince, campaignRecipients } = action;
    const title = action.campaignTitle;
    const body = action.campaignBody;

    if (
      !campaignSegment ||
      !campaignSince ||
      !campaignRecipients ||
      campaignRecipients.length === 0 ||
      !title ||
      !body
    ) {
      throw new ProposalError("CAMPAIGN_CONTENT_INVALID");
    }

    // 2) Shop ownership, from the database, against the session's user id.
    //    There is no field in the request that names a shop or an owner.
    const { data: shop, error: shopError } = await ctx.supabase
      .from("shops")
      .select("id, name, owner_id")
      .eq("id", action.shopId)
      .maybeSingle();

    if (shopError) throw new ProposalError("UNAVAILABLE");
    if (!shop) throw new ProposalError("SHOP_NOT_FOUND");
    if (shop.owner_id !== ctx.userId) throw new ProposalError("NOT_SHOP_OWNER");

    // 3) The stored segment is still one of the six.
    if (!isSegmentKey(campaignSegment)) {
      throw new ProposalError("SEGMENT_UNKNOWN");
    }

    // 4) The content that is about to be sent. The owner's edit, if there was
    //    one, is already on the row by now — the route applied it through
    //    `ai_action_apply_campaign_edit` before calling this — so what is
    //    checked here is what actually goes out.
    if (campaignShapeProblem(title, body)) {
      throw new ProposalError("CAMPAIGN_CONTENT_INVALID");
    }

    // 5) The audience. Recomputed with the SAME segment and the SAME stored
    //    cutoff, so a difference is a real change in the shop's customers.
    const { data: freshRows, error: freshError } = await ctx.supabase.rpc(
      "shop_campaign_recipients",
      {
        p_shop_id: action.shopId,
        p_segment: campaignSegment,
        p_since: campaignSince,
      },
    );
    if (freshError) throw campaignRefusal(freshError);

    const fresh = (freshRows ?? []) as unknown as string[];
    if (!sameAudience(campaignRecipients, fresh)) {
      throw new ProposalError("SEGMENT_CHANGED");
    }

    // The app's own broadcast. It re-checks every one of the five things
    // above, in SQL, and takes the recipients from the row rather than from
    // this call — the two content arguments exist only so a mismatch fails
    // loudly instead of being resolved silently in either direction.
    const { data: sent, error } = await ctx.supabase.rpc("broadcast_campaign", {
      p_shop_id: action.shopId,
      p_action_id: action.id,
      p_title: title,
      p_body: body,
    });

    if (error) throw campaignRefusal(error);

    // `sent` is the number of notification rows the insert actually created.
    // Never the recipient count and never a figure from the proposal: a
    // customer who muted promotions in the seconds before the send is not a
    // person who received anything, and the card must not say they were.
    const sentCount = typeof sent === "number" ? sent : 0;

    return {
      // A campaign creates N rows rather than one, so there is no id to point
      // at. `ai_action_settle` takes the count instead, and the route passes
      // it through `resultCount`.
      resultId: null,
      resultCount: sentCount,
      payload: {
        campaign: {
          segment: campaignSegment,
          recipientCount: campaignRecipients.length,
          // The two figures are reported separately and both are real. They
          // differ when somebody opted out between the proposal and the send,
          // and collapsing them into one number would mean either overstating
          // the delivery or hiding the opt-out.
          sentCount,
          title,
          body,
        },
        shop: { id: shop.id, name: shop.name },
      },
    };
  },

  /**
   * A campaign's outcome is recountable, so this one genuinely heals.
   *
   * The other two reconcilers either match a row exactly (an appointment) or
   * refuse to guess (a coupon). A campaign is the case where the database can
   * simply be ASKED: every notification it created carries the action's id in
   * its `data`, and `campaign_send_count()` counts them behind an ownership
   * check. So a CONFIRMED row whose settle was lost has an exact answer —
   * "three notifications exist for this campaign" — rather than a plausible
   * one.
   *
   * A count of zero returns null rather than an outcome, and that distinction
   * matters: zero means either "the send never ran" or "it ran and everybody
   * had muted promotions", and those are different things to write in an audit
   * trail. Refusing to settle leaves the row CONFIRMED, which is honest about
   * not knowing, and the daily budget plus the uniqueness index mean a retry
   * cannot double-send while the question is open.
   */
  async reconcile(ctx: ToolContext, action: ConfirmedAction) {
    const { data: count, error } = await ctx.supabase.rpc("campaign_send_count", {
      p_action_id: action.id,
    });

    if (error || typeof count !== "number" || count <= 0) return null;

    return {
      resultId: null,
      resultCount: count,
      alreadyExecuted: true,
      payload: {
        campaign: {
          segment: action.campaignSegment,
          recipientCount: action.campaignRecipients?.length ?? count,
          sentCount: count,
          title: action.campaignTitle,
          body: action.campaignBody,
        },
      },
    };
  },
};
