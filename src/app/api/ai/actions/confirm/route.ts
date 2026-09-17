import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  AI_ACTION_SEND_CAMPAIGN,
  ProposalError,
  type AiProposalDraft,
  type ProposalRefusal,
} from "@/lib/ai/proposals";
import {
  CAMPAIGN_BODY_MAX,
  CAMPAIGN_TITLE_MAX,
  campaignShapeProblem,
} from "@/lib/campaign-content";
import { executorFor, type ActionOutcome, type ConfirmedAction } from "@/lib/ai/actions";
import type { ToolContext } from "@/lib/ai/types";

/**
 * The confirmed action endpoint — where, and only where, the AI's mutations
 * actually happen.
 *
 * ---------------------------------------------------------------------------
 * The model is not in this request
 * ---------------------------------------------------------------------------
 * That is the single most important fact about this file. No Anthropic client
 * is imported, no prompt is assembled, no `runAgentLoop` is called, and there
 * is no field in the body a model could have filled in. What arrives is a
 * proposal id and a nonce, sent by a button the customer pressed.
 *
 * So the chain of custody for every value that matters is:
 *
 *   which action        →  `action_type` on the stored row, a Postgres enum
 *                          with three members, written by
 *                          `ai_action_propose()`
 *   shopId, serviceIds, →  the stored PROPOSED row, written from ids a
 *   staffId, startsAt,     discovery tool RETURNED in that request and that a
 *   rewardId               `prepare_*` tool re-verified against the ledger
 *   customerId          →  auth.getUser() here, in this request
 *   price, duration,    →  the insert trigger / the RPC, inside the write
 *   position, chair,
 *   points, coupon code
 *
 * The client cannot substitute a shop, a service, a slot, a staff member or a
 * reward, because it does not send them. It sends an id, and the row that id
 * names was written server-side.
 *
 * ---------------------------------------------------------------------------
 * One endpoint, three explicit paths — not one generic one
 * ---------------------------------------------------------------------------
 * There is no `POST /api/ai/do-anything`, and the difference is not cosmetic.
 * The route claims a proposal, switches on the claimed row's action type, and
 * hands off to that type's executor. `executorFor` is a `switch` whose default
 * returns null, so an action type with no executor is settled FAILED rather
 * than being dispatched to whatever came first. Each executor has its own
 * revalidation and calls exactly one existing business function.
 *
 * What makes this closed rather than merely tidy: nothing in the request
 * selects the branch. A body field naming an action, a function or a table
 * would be the vulnerability; the branch comes from a column.
 *
 * ---------------------------------------------------------------------------
 * The order of operations, and why each step is where it is
 * ---------------------------------------------------------------------------
 *   1. authenticate                     — 401 before anything else happens
 *   2. sweep lapsed proposals           — so EXPIRED is a stored fact, not a
 *                                         computed one (see the migration's
 *                                         note on raise-rolls-back)
 *   3. CLAIM the proposal               — atomic PROPOSED → CONFIRMED. This is
 *                                         the replay guard, and it comes BEFORE
 *                                         revalidation so that a double-tap
 *                                         cannot have two requests both pass
 *                                         validation and both write
 *   4. pick the executor                — from the row's type, or refuse
 *   5. revalidate, then the ONE write   — inside the executor
 *   6. settle the audit row             — EXECUTED with the result id, or
 *                                         FAILED with a code
 *
 * Step 3 before step 4 is deliberate and was the other way round first. With
 * validation first, two simultaneous confirmations would both validate, both
 * try to write, and the second would be stopped only by a database constraint
 * — which does stop it, but leaves an audit row claiming a failure that was
 * really a duplicate. Claiming first means the second request never gets as far
 * as looking.
 *
 * ---------------------------------------------------------------------------
 * The atomicity boundary, stated rather than glossed
 * ---------------------------------------------------------------------------
 * Steps 5 and 6 are two separate writes and they are NOT atomic. There is no
 * transaction spanning them, because the alternative would be a SECURITY
 * DEFINER function that performs the booking AND updates the audit — and that
 * function would become a second implementation of rules the triggers and RPCs
 * already own.
 *
 * So the honest description of the window: if step 5 succeeds and step 6 is
 * lost (a crash, a dropped connection), the customer HAS the thing and the
 * audit row stays CONFIRMED rather than EXECUTED. What that costs is accuracy
 * of the record. What it does NOT cost is correctness of the action:
 *
 *   · the serial / appointment / coupon exists and is visible on the
 *     customer's own screens;
 *   · a retry cannot duplicate it. `one_active_serial_per_customer` refuses a
 *     second serial and `appointments_no_overlap` refuses a second booking at
 *     the same time, independently of the audit; and step 3's claim already
 *     refuses a second confirmation of the same proposal, which is what stops a
 *     second COUPON, since coupons have no natural uniqueness;
 *   · so the failure mode is a missing explanation, never a missing booking or
 *     a double one.
 *
 * Reconciliation closes most of that gap for the two actions where the created
 * row can be identified EXACTLY — a serial by (customer, shop, active) and an
 * appointment by (customer, shop, staff, start). It deliberately does not for a
 * redemption, because a coupon carries no link back to its proposal and
 * matching one would be a guess; see `redeem-reward-action.ts`.
 */

const MAX_NONCE = 128;

const BodySchema = z.object({
  /** The proposal to confirm. Not the action, not the shop — just its id. */
  actionId: z.string().uuid(),
  /**
   * Read back from the row the client fetched under RLS. RLS is what actually
   * stops one customer confirming another's proposal; this is the second
   * factor, proving the caller read the row rather than guessed its id.
   */
  nonce: z.string().min(16).max(MAX_NONCE),
  /**
   * AI Sprint 5. The owner's edited campaign wording, if they changed it.
   *
   * ---------------------------------------------------------------------
   * The only field in this body that is not an identifier, and why that is
   * still safe
   * ---------------------------------------------------------------------
   * §13 requires that the owner be able to rewrite the message before
   * approving it, and that "the edited text becomes the actual text to be
   * sent". So one content field had to become writable at confirm time. What
   * matters is what did NOT become writable, and the list is enforced by
   * absence rather than by validation — there is no field here for a shop, a
   * segment, a recipient, a customer, a count or an action type, so §13's
   * "do not allow editing shop_id / recipient segment ownership / arbitrary
   * customer IDs / action type" is not a rule this handler follows, it is a
   * shape the request cannot express.
   *
   * It is also not the model's text. The model's draft is frozen in
   * `display`; this arrives from a textarea a person typed into. That
   * distinction is why it is not held to the invented-offer check: an owner
   * may promise a discount they have not yet configured, because they are the
   * business (§9's "or explicitly owner-provided text").
   *
   * And it does not reach the send directly. It is written to the row by
   * `ai_action_apply_campaign_edit()` — CONFIRMED rows only, own rows only,
   * SEND_CAMPAIGN only — and the executor then reads the content back OFF the
   * row. So the text that goes out and the text in the audit trail are the
   * same string by construction, not by two code paths agreeing.
   *
   * Ignored entirely for the other three action types.
   */
  campaign: z
    .object({
      title: z.string().min(1).max(CAMPAIGN_TITLE_MAX),
      body: z.string().min(1).max(CAMPAIGN_BODY_MAX),
    })
    .optional(),
});

/** What the UI is told. A closed vocabulary, never a database message. */
interface ConfirmFailure {
  ok: false;
  code: ProposalRefusal;
  /** Bangla, from the app's existing error vocabulary where one fits. */
  message: string;
}

/**
 * Map a refusal to a sentence the customer can act on.
 *
 * One entry per code, and the compiler requires it — a new refusal cannot be
 * added without deciding what the customer is told, which is the point of
 * keeping this a `Record` rather than a lookup with a fallback.
 */
export const REFUSAL_MESSAGES: Record<ProposalRefusal, string> = {
  // --- shared ---------------------------------------------------------------
  SHOP_NOT_OFFERED: "দোকানটা আর পাওয়া যাচ্ছে না — আবার খুঁজে দেখো।",
  SERVICE_NOT_OFFERED: "সার্ভিসটা আর পাওয়া যাচ্ছে না — আবার খুঁজে দেখো।",
  SHOP_NOT_FOUND: "দোকানটা আর পাওয়া যাচ্ছে না — আবার খুঁজে দেখো।",
  SERVICE_NOT_FOUND: "সার্ভিসটা আর নেই — তালিকা রিফ্রেশ করে দেখো।",
  SERVICE_WRONG_SHOP: "সার্ভিসটা এই দোকানের নয় — আবার বেছে নাও।",
  SERVICE_INACTIVE: "সার্ভিসটা এখন বন্ধ আছে — অন্যটা বেছে নাও।",
  EXPIRED: "সময় পেরিয়ে গেছে, তাই হিসাবটা আর ঠিক নেই — আরেকবার জিজ্ঞেস করো।",
  ALREADY_EXECUTED: "এটা আগেই নিশ্চিত করা হয়েছে — নিজের পাতায় দেখে নাও।",
  CANCELLED: "এটা বাতিল করা হয়েছে।",
  NOT_FOUND: "অনুরোধটা পাওয়া যায়নি — আরেকবার জিজ্ঞেস করো।",
  BAD_NONCE: "অনুরোধটা পাওয়া যায়নি — আরেকবার জিজ্ঞেস করো।",
  UNAVAILABLE: "এখন কাজটা করা গেল না — আরেকবার চেষ্টা করো।",

  // --- JOIN_QUEUE -----------------------------------------------------------
  NOT_A_QUEUE_SHOP:
    "এই দোকান লাইনে সিরিয়াল নেয় না, অ্যাপয়েন্টমেন্ট নেয় — সময় দেখে বুক করতে বলো।",
  SHOP_NOT_ACCEPTING: "এই দোকান এখন নতুন সিরিয়াল নিচ্ছে না।",
  ALREADY_IN_QUEUE: "তোমার আগে থেকেই একটা সিরিয়াল চলছে — একসাথে একটাই রাখা যায়।",
  QUEUE_REFUSED: "সিরিয়াল নেওয়া গেল না।",

  // --- BOOK_APPOINTMENT -----------------------------------------------------
  NOT_AN_APPOINTMENT_SHOP:
    "এই দোকান অ্যাপয়েন্টমেন্ট নেয় না, লাইনে সিরিয়াল দেয় — লাইনে ঢুকতে চাইলে বলো।",
  SHOP_NOT_ACTIVE: "এই দোকান এখন বুকিং নিচ্ছে না।",
  SLOT_NOT_OFFERED: "এই সময়টা খালি সময়ের তালিকায় ছিল না — আবার সময় দেখে নাও।",
  SLOT_UNAVAILABLE: "এই সময়টা এইমাত্র কেউ নিয়ে নিয়েছে — আরেকটা সময় বেছে নাও।",
  SLOT_IN_PAST: "সময়টা পেরিয়ে গেছে — নতুন সময় বেছে নাও।",
  STAFF_NOT_FOUND: "যাঁর কাছে সময় নেওয়া হয়েছিল তাঁকে আর পাওয়া যাচ্ছে না — আবার সময় দেখো।",
  STAFF_WRONG_SHOP: "এই কর্মী এই দোকানের নন — আবার সময় দেখে নাও।",
  STAFF_INACTIVE: "যাঁর কাছে সময় নেওয়া হয়েছিল তিনি এখন নেই — অন্য সময় বেছে নাও।",
  STAFF_CANNOT_PERFORM: "এই সার্ভিসটা তিনি করেন না — অন্য কারো সময় বেছে নাও।",
  DURATION_UNAVAILABLE: "সার্ভিসটার সময় কত লাগবে দোকান লিখে রাখেনি, তাই বুক করা গেল না।",
  PRICE_CHANGED: "দাম বদলে গেছে, তাই আগের হিসাবে করা গেল না — আরেকবার জিজ্ঞেস করো।",
  ALREADY_BOOKED: "এই সময়ে তোমার বুকিং আগেই আছে — অ্যাপয়েন্টমেন্ট পাতায় দেখো।",
  APPOINTMENT_REFUSED: "অ্যাপয়েন্টমেন্ট নেওয়া গেল না।",

  // --- REDEEM_REWARD --------------------------------------------------------
  REWARD_NOT_OFFERED: "রিওয়ার্ডটা তালিকায় ছিল না — আবার দেখে নাও।",
  REWARD_NOT_FOUND: "রিওয়ার্ডটা আর নেই — তালিকা রিফ্রেশ করে দেখো।",
  REWARD_WRONG_SHOP:
    "এই রিওয়ার্ড অন্য দোকানের — পয়েন্ট যে দোকানে জমেছে, সেই দোকানেই খরচ হয়।",
  REWARD_INACTIVE: "রিওয়ার্ডটা এখন বন্ধ আছে।",
  REWARD_EXPIRED: "রিওয়ার্ডটার মেয়াদ শেষ।",
  REWARD_OUT_OF_STOCK: "রিওয়ার্ডটা শেষ হয়ে গেছে।",
  INSUFFICIENT_POINTS: "এই দোকানে তোমার পয়েন্ট যথেষ্ট নেই।",
  NO_LOYALTY_ACCOUNT: "এই দোকানে তোমার এখনো কোনো পয়েন্ট জমেনি।",
  REDEMPTION_REFUSED: "রিওয়ার্ডটা নেওয়া গেল না।",

  // --- SEND_CAMPAIGN (owner) ------------------------------------------------
  NOT_SHOP_OWNER: "এটা তোমার দোকান নয়।",
  SEGMENT_NOT_OFFERED: "গ্রুপটা তালিকায় ছিল না — আবার দেখে নাও।",
  SEGMENT_UNKNOWN: "এই নামে কোনো কাস্টমার গ্রুপ নেই।",
  NOT_ENOUGH_HISTORY:
    "নির্ভরযোগ্য গ্রুপ বানানোর মতো যথেষ্ট সার্ভিসের রেকর্ড এখনো জমেনি।",
  SEGMENT_EMPTY: "এই গ্রুপে এখন কেউ নেই।",
  SEGMENT_TOO_SMALL:
    "এত কম লোককে ব্রডকাস্ট পাঠানো যায় না — তাঁদের সাথে সরাসরি কথা বলো।",
  SEGMENT_TOO_LARGE: "একবারে এত জনকে পাঠানো যায় না — গ্রুপটা ছোট করো।",
  WINDOW_INVALID: "সময়ের হিসাবটা ঠিক নেই — আরেকবার জিজ্ঞেস করো।",
  // The refusal an owner is most likely to actually meet, so it says what
  // happened AND what to do, rather than only that something was refused.
  SEGMENT_CHANGED:
    "কারা পাবে সেই তালিকাটা এর মধ্যে বদলে গেছে — পুরনো তালিকায় পাঠানো হলো না। আরেকবার জিজ্ঞেস করে নতুন তালিকা দেখো।",
  CAMPAIGN_CONTENT_INVALID: "বার্তাটা ঠিক নেই — লেখাটা দেখে আবার চেষ্টা করো।",
  CAMPAIGN_INVENTS_OFFER:
    "বার্তায় এমন ছাড় বা দামের কথা আছে যা দোকানে সেট করা নেই — অফারটা আগে তৈরি করো, নয়তো লেখা থেকে ওই সংখ্যাটা বাদ দাও।",
  BROADCAST_LIMIT_REACHED:
    "আজকে একবার প্রোমো পাঠানো হয়ে গেছে — আগামীকাল আবার চেষ্টা করো।",
  RECIPIENT_NOT_A_CUSTOMER:
    "তালিকায় এমন কেউ আছে যিনি এই দোকানের কাস্টমার নন — পাঠানো হলো না।",
  CAMPAIGN_REFUSED: "ক্যাম্পেইনটা পাঠানো গেল না।",
};

function refuse(code: ProposalRefusal, status = 409, message?: string) {
  const body: ConfirmFailure = { ok: false, code, message: message ?? REFUSAL_MESSAGES[code] };
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Postgres's refusal → one of our codes.
 *
 * The strings matched here are raised by `ai_action_claim()`; they are its
 * deliberate vocabulary and contain no schema detail. Anything unrecognised
 * becomes UNAVAILABLE rather than being echoed, so a constraint name cannot
 * reach a customer.
 */
function claimRefusal(err: unknown): ProposalRefusal {
  const raw =
    err instanceof Error
      ? err.message
      : String((err as { message?: string })?.message ?? err ?? "");
  if (raw.includes("ai_action_expired")) return "EXPIRED";
  if (raw.includes("ai_action_already_executed")) return "ALREADY_EXECUTED";
  if (raw.includes("ai_action_cancelled")) return "CANCELLED";
  if (raw.includes("ai_action_nonce_mismatch")) return "BAD_NONCE";
  if (raw.includes("ai_action_not_found")) return "NOT_FOUND";
  // `ai_action_not_claimable` — CONFIRMED or FAILED already. Handled by the
  // reconciliation path before this is consulted, so reaching here means a
  // genuinely spent proposal.
  if (raw.includes("ai_action_not_claimable")) return "ALREADY_EXECUTED";
  return "UNAVAILABLE";
}

/** The claimed row, narrowed to what an executor is allowed to see. */
type ClaimedRow = {
  id: string;
  action_type: string;
  shop_id: string | null;
  service_ids: string[];
  staff_id: string | null;
  starts_at: string | null;
  reward_id: string | null;
  campaign_segment?: string | null;
  campaign_since?: string | null;
  campaign_recipients?: string[] | null;
  campaign_title?: string | null;
  campaign_body?: string | null;
  display: unknown;
};

function toConfirmedAction(row: ClaimedRow, shopId: string): ConfirmedAction {
  return {
    id: row.id,
    actionType: row.action_type as ConfirmedAction["actionType"],
    shopId,
    serviceIds: row.service_ids ?? [],
    staffId: row.staff_id,
    startsAt: row.starts_at,
    rewardId: row.reward_id,
    // The campaign's audience and words, off the row. The snapshot is
    // server-written state and the content is whatever the row currently
    // holds — which, if the owner edited it, is their version rather than the
    // model's, because the edit was applied to the row before this ran.
    campaignSegment: row.campaign_segment ?? null,
    campaignSince: row.campaign_since ?? null,
    campaignRecipients: row.campaign_recipients ?? null,
    campaignTitle: row.campaign_title ?? null,
    campaignBody: row.campaign_body ?? null,
    // The stored snapshot, used only for the changed-terms comparison. The
    // shape was written by this server from a verified draft, but it is still
    // treated as data: each executor checks `display.action` matches its own
    // type before reading a field off it.
    display: (row.display as AiProposalDraft | null) ?? null,
  };
}

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND" }, { status: 400 });
  }
  const { actionId, nonce, campaign } = parsed.data;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 401 before anything is read or written. An unauthenticated caller cannot
  // discover whether a proposal id is real.
  if (!user) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND" }, { status: 401 });
  }

  // The owner's edit is shape-checked here: AFTER authentication, because this
  // route's first promise is a 401 before anything else happens, and BEFORE
  // the claim, because a title of eighty spaces should be refused while the
  // proposal is still confirmable rather than after it has been spent.
  //
  // It sat above `auth.getUser()` for one revision, which a runtime probe
  // caught: an unauthenticated caller got CAMPAIGN_CONTENT_INVALID instead of
  // a 401. Nothing leaked — the check is about text the caller themselves
  // submitted — but a route whose documented order is "401 first" should keep
  // that promise rather than have an exception nobody remembers.
  //
  // Shape and length only. NOT an offer check: an owner may promise a discount
  // they have not yet configured, because they are the business (§9's "or
  // explicitly owner-provided text"). The invented-offer guard applies to what
  // the MODEL drafted, and it ran at propose time.
  if (campaign && campaignShapeProblem(campaign.title, campaign.body)) {
    return refuse("CAMPAIGN_CONTENT_INVALID", 400);
  }

  // Everything downstream runs on this: the cookie-bound client, so RLS is
  // live on every read and every write, and the user id from the session. The
  // service-role client is deliberately absent from this whole path, and a
  // test asserts no module in it imports one.
  const ctx: ToolContext = {
    supabase,
    userId: user.id,
    shopId: null,
    now: new Date(),
  };

  // Lapsed proposals become EXPIRED here rather than inside the claim, because
  // a `raise` in plpgsql rolls back the UPDATE that preceded it. Best-effort:
  // if the sweep fails the claim below still refuses an expired row, it just
  // leaves the record untidy.
  await supabase.rpc("ai_action_expire_mine");

  // ---------------------------------------------------------------------
  // 1) Claim it — atomically, and before any validation
  // ---------------------------------------------------------------------
  const claim = await supabase.rpc("ai_action_claim", {
    p_action_id: actionId,
    p_nonce: nonce,
  });

  if (claim.error) {
    const code = claimRefusal(claim.error);

    // Reconciliation. A row already past PROPOSED means an earlier attempt
    // claimed it; if that attempt's write actually succeeded but its settle was
    // lost, the customer HAS the thing and deserves to be told so rather than
    // shown a failure.
    if (code === "ALREADY_EXECUTED") {
      const healed = await reconcile(ctx, actionId);
      if (healed) return healed;
    }
    return refuse(code);
  }

  const action = claim.data as ClaimedRow | null;
  if (!action) {
    await settleFailed(supabase, actionId, "UNAVAILABLE");
    return refuse("UNAVAILABLE");
  }
  if (!action.shop_id) {
    // `ai_action_propose` now refuses a shopless proposal outright, so this is
    // unreachable for anything created after 20261001. Kept because an older
    // row could still exist, and because "the row is malformed" must not become
    // "the executor got a null and did something creative with it".
    await settleFailed(supabase, actionId, "SHOP_NOT_FOUND");
    return refuse("SHOP_NOT_FOUND");
  }

  // ---------------------------------------------------------------------
  // 2) Which action is this, and who performs it?
  // ---------------------------------------------------------------------
  const executor = executorFor(action.action_type);
  if (!executor) {
    // The enum has exactly three members and all three have an executor, so
    // this is unreachable today. It is here so that a FUTURE action type cannot
    // be executed by this endpoint the moment it exists — a new action must
    // bring its own confirmed path, and until it does, confirming one fails
    // loudly and writes nothing.
    await settleFailed(supabase, actionId, "UNAVAILABLE");
    return refuse("UNAVAILABLE");
  }

  // ---------------------------------------------------------------------
  // 3) Apply the owner's edit, if this is a campaign and they made one
  // ---------------------------------------------------------------------
  // Between the claim and the send, and in that order for two reasons. The
  // claim first, so a double-tap cannot have two requests each rewriting the
  // message before either sends. And the edit before the executor, so the
  // executor reads the final words OFF THE ROW — which is what makes the text
  // that goes out and the text in the audit the same string rather than two
  // values that have to agree.
  //
  // `ai_action_apply_campaign_edit` has exactly two parameters, so this cannot
  // change the shop, the segment, the recipients, the status or the action
  // type. It refuses a row that is not a CONFIRMED SEND_CAMPAIGN belonging to
  // the caller.
  let claimed: ClaimedRow = action;
  if (campaign && action.action_type === AI_ACTION_SEND_CAMPAIGN) {
    const edited = await supabase.rpc("ai_action_apply_campaign_edit", {
      p_action_id: actionId,
      p_title: campaign.title,
      p_body: campaign.body,
    });
    if (edited.error || !edited.data) {
      // The proposal is spent either way — it is CONFIRMED and cannot be
      // claimed again — so this settles FAILED rather than leaving a row that
      // reads as approved but never sent.
      await settleFailed(supabase, actionId, "CAMPAIGN_CONTENT_INVALID");
      return refuse("CAMPAIGN_CONTENT_INVALID");
    }
    claimed = edited.data as ClaimedRow;
  }

  // ---------------------------------------------------------------------
  // 4) Revalidate against live state, then perform the ONE write
  // ---------------------------------------------------------------------
  let outcome: ActionOutcome;
  try {
    outcome = await executor.execute(ctx, toConfirmedAction(claimed, action.shop_id));
  } catch (err) {
    const code = err instanceof ProposalError ? err.code : "UNAVAILABLE";
    await settleFailed(supabase, actionId, code);
    // A ProposalError's `detail` is the app's own Bangla for a refusal the
    // database produced — already scrubbed by `translateDbError`, so a slot
    // somebody just took reads the same however the customer arrived at it.
    const detail = err instanceof ProposalError ? err.detail : undefined;
    return refuse(code, 409, detail || REFUSAL_MESSAGES[code]);
  }

  // ---------------------------------------------------------------------
  // 5) Settle the audit row
  // ---------------------------------------------------------------------
  // The only place `EXECUTED` is written, and it needs PROOF to do it: a
  // result id for the three actions that create a row, and a count for the
  // campaign, which creates N notifications and has no single row to name.
  // Which COLUMN either lands in is decided by `ai_action_settle()` from the
  // row's own action type — not by this caller.
  await supabase.rpc("ai_action_settle", {
    p_action_id: actionId,
    p_status: "EXECUTED",
    p_result_id: outcome.resultId,
    p_failure_code: null,
    p_result_count: outcome.resultCount ?? null,
  });

  return NextResponse.json(
    { ok: true, actionType: action.action_type, ...outcome.payload },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Record a failure against the audit row. Best-effort; never masks the cause. */
async function settleFailed(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  actionId: string,
  code: ProposalRefusal,
) {
  await supabase.rpc("ai_action_settle", {
    p_action_id: actionId,
    p_status: "FAILED",
    p_result_id: null,
    p_failure_code: code,
    p_result_count: null,
  });
}

/**
 * Heal a CONFIRMED row whose settle was lost, or report one already settled.
 *
 * Only called when the claim reported the proposal was already spent. Two
 * cases, and only the second involves looking anything up:
 *
 *   EXECUTED   the outcome is already recorded — report it from the row,
 *              without re-running anything;
 *   CONFIRMED  an earlier attempt claimed it and may or may not have completed.
 *              The executor is asked whether it can identify what that attempt
 *              created, and it answers only when it can do so exactly.
 *
 * Anything else — CANCELLED, EXPIRED, FAILED — returns null and the caller
 * refuses normally. Note that the read is under RLS on the customer's own rows,
 * so a proposal belonging to somebody else is invisible here too.
 */
async function reconcile(
  ctx: ToolContext,
  actionId: string,
): Promise<NextResponse | null> {
  const { data: action } = await ctx.supabase
    .from("ai_actions")
    .select(
      "id, status, action_type, shop_id, service_ids, nonce, display, staff_id, starts_at, reward_id, campaign_segment, campaign_since, campaign_recipients, campaign_title, campaign_body, campaign_sent_count, serial_id, appointment_id, redemption_id",
    )
    .eq("id", actionId)
    .maybeSingle();

  if (!action) return null;

  if (action.status === "EXECUTED") {
    // Whichever result column the type uses. Reported as the id alone — or,
    // for a campaign, the count, which is its result. The action is finished,
    // the caller's own screens hold the detail, and re-reading rows to
    // decorate a duplicate confirmation would be work done for a request that
    // changed nothing.
    return NextResponse.json(
      {
        ok: true,
        alreadyExecuted: true,
        actionType: action.action_type,
        resultId:
          action.serial_id ?? action.appointment_id ?? action.redemption_id ?? null,
        ...(action.campaign_sent_count !== null
          ? { campaign: { sentCount: action.campaign_sent_count } }
          : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (action.status !== "CONFIRMED" || !action.shop_id) return null;

  const executor = executorFor(action.action_type);
  if (!executor) return null;

  const healed = await executor.reconcile(
    ctx,
    toConfirmedAction(action as ClaimedRow, action.shop_id),
  );
  if (!healed) return null;

  await ctx.supabase.rpc("ai_action_settle", {
    p_action_id: actionId,
    p_status: "EXECUTED",
    p_result_id: healed.resultId,
    p_failure_code: null,
    p_result_count: healed.resultCount ?? null,
  });

  return NextResponse.json(
    { ok: true, alreadyExecuted: true, actionType: action.action_type, ...healed.payload },
    { headers: { "Cache-Control": "no-store" } },
  );
}
