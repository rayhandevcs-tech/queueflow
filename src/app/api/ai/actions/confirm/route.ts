import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { joinQueue } from "@/lib/queue-join";
import { translateDbError } from "@/lib/supabase/db-errors";
import {
  AI_ACTION_JOIN_QUEUE,
  ProposalError,
  type ProposalRefusal,
} from "@/lib/ai/proposals";
import { buildJoinQueueDraft } from "@/lib/ai/tools/join-queue-prepare";
import type { ToolContext } from "@/lib/ai/types";

/**
 * The confirmed action endpoint — where, and only where, the AI's queue join
 * actually happens.
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
 *   shopId, serviceIds  →  the stored PROPOSED row, written by the agent route
 *                          from ids that a discovery tool returned in that
 *                          request and that `prepare_join_queue` re-verified
 *   customerId          →  auth.getUser() here, in this request
 *   price, position,    →  serial_before_insert, inside the write
 *   chair, status
 *
 * The client cannot substitute a shop or a service, because it does not send
 * them. It sends an id, and the row that id names was written server-side.
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
 *                                         validation and both insert
 *   4. revalidate against live state    — the same rules `prepare_join_queue`
 *                                         used, run again, because the shop may
 *                                         have closed in the meantime
 *   5. the ordinary queue INSERT        — under RLS, through the trigger
 *   6. settle the audit row             — EXECUTED with the serial, or FAILED
 *                                         with a code
 *
 * Step 3 before step 4 is deliberate and was the other way round first. With
 * validation first, two simultaneous confirmations would both validate, both
 * try to insert, and the second would be stopped only by
 * `one_active_serial_per_customer` — which does stop it, but leaves an audit
 * row claiming a failure that was really a duplicate. Claiming first means the
 * second request never gets as far as looking.
 *
 * ---------------------------------------------------------------------------
 * The atomicity boundary, stated rather than glossed
 * ---------------------------------------------------------------------------
 * Steps 5 and 6 are two separate writes and they are NOT atomic. There is no
 * transaction spanning them, because the alternative would be a SECURITY
 * DEFINER function that inserts the serial AND updates the audit — and that
 * function would become a second implementation of the queue's rules, outside
 * the trigger that owns them.
 *
 * So the honest description of the window: if step 5 succeeds and step 6 is
 * lost (a crash, a dropped connection), the customer IS in the queue and the
 * audit row stays CONFIRMED rather than EXECUTED. What that costs is accuracy
 * of the record. What it does NOT cost is correctness of the booking:
 *
 *   · the serial exists and is visible in the customer's own queue screen;
 *   · a retry cannot double-book, because `one_active_serial_per_customer`
 *     refuses a second active serial — the guarantee does not depend on the
 *     audit row at all;
 *   · and step 3's claim already refuses a second confirmation.
 *
 * The reconciliation below closes most of that gap: a confirmation arriving for
 * a row that is already CONFIRMED looks for the customer's active serial at
 * that shop, and if it finds one, settles the row as EXECUTED against it and
 * reports success. So the stuck state heals on the next attempt rather than
 * needing a sweeper.
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
});

/** What the UI is told. A closed vocabulary, never a database message. */
interface ConfirmFailure {
  ok: false;
  code: ProposalRefusal;
  /** Bangla, from the app's existing error vocabulary where one fits. */
  message: string;
}

/** Map a refusal to a sentence the customer can act on. */
const REFUSAL_MESSAGES: Record<ProposalRefusal, string> = {
  SHOP_NOT_OFFERED: "দোকানটা আর পাওয়া যাচ্ছে না — আবার খুঁজে দেখো।",
  SERVICE_NOT_OFFERED: "সার্ভিসটা আর পাওয়া যাচ্ছে না — আবার খুঁজে দেখো।",
  SHOP_NOT_FOUND: "দোকানটা আর পাওয়া যাচ্ছে না — আবার খুঁজে দেখো।",
  NOT_A_QUEUE_SHOP:
    "এই দোকান লাইনে সিরিয়াল নেয় না, অ্যাপয়েন্টমেন্ট নেয় — দোকানের পাতা থেকে সময় বেছে নাও।",
  SHOP_NOT_ACCEPTING: "এই দোকান এখন নতুন সিরিয়াল নিচ্ছে না।",
  SERVICE_NOT_FOUND: "সার্ভিসটা আর নেই — তালিকা রিফ্রেশ করে দেখো।",
  SERVICE_WRONG_SHOP: "সার্ভিসটা এই দোকানের নয় — আবার বেছে নাও।",
  SERVICE_INACTIVE: "সার্ভিসটা এখন বন্ধ আছে — অন্যটা বেছে নাও।",
  ALREADY_IN_QUEUE: "তোমার আগে থেকেই একটা সিরিয়াল চলছে — একসাথে একটাই রাখা যায়।",
  EXPIRED: "সময় পেরিয়ে গেছে, তাই লাইনের হিসাবটা আর ঠিক নেই — আরেকবার জিজ্ঞেস করো।",
  ALREADY_EXECUTED: "এটা আগেই নিশ্চিত করা হয়েছে — তোমার সিরিয়াল পাতায় দেখো।",
  CANCELLED: "এটা বাতিল করা হয়েছে।",
  NOT_FOUND: "অনুরোধটা পাওয়া যায়নি — আরেকবার জিজ্ঞেস করো।",
  BAD_NONCE: "অনুরোধটা পাওয়া যায়নি — আরেকবার জিজ্ঞেস করো।",
  QUEUE_REFUSED: "সিরিয়াল নেওয়া গেল না।",
  UNAVAILABLE: "এখন কাজটা করা গেল না — আরেকবার চেষ্টা করো।",
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
  const raw = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err ?? "");
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

export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND" }, { status: 400 });
  }
  const { actionId, nonce } = parsed.data;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // 401 before anything is read or written. An unauthenticated caller cannot
  // discover whether a proposal id is real.
  if (!user) {
    return NextResponse.json({ ok: false, code: "NOT_FOUND" }, { status: 401 });
  }

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

    // Reconciliation. A row already CONFIRMED means an earlier attempt claimed
    // it; if that attempt's insert actually succeeded but its settle was lost,
    // the customer IS in the queue and deserves to be told so rather than shown
    // a failure. Look for the serial, and heal the record if it is there.
    if (code === "ALREADY_EXECUTED") {
      const healed = await reconcile(supabase, actionId, user.id);
      if (healed) return healed;
    }
    return refuse(code);
  }

  const action = claim.data;
  if (!action || action.action_type !== AI_ACTION_JOIN_QUEUE) {
    // The enum has one member, so this is unreachable today. It is here so that
    // Sprint 4's action types cannot be executed by this endpoint the moment
    // they exist — a new action must bring its own confirmed path.
    await settleFailed(supabase, actionId, "UNAVAILABLE");
    return refuse("UNAVAILABLE");
  }
  if (!action.shop_id) {
    await settleFailed(supabase, actionId, "SHOP_NOT_FOUND");
    return refuse("SHOP_NOT_FOUND");
  }

  // ---------------------------------------------------------------------
  // 2) Revalidate against live state
  // ---------------------------------------------------------------------
  // The SAME rules `prepare_join_queue` ran, from the same functions, because
  // "revalidated" only means something if the second check is the first check.
  // The figures in the stored `display` are NOT consulted: the shop may have
  // closed, the service may have been switched off, the price may have moved,
  // and the customer may have taken a serial elsewhere since they were asked.
  const ctx: ToolContext = {
    supabase,
    userId: user.id,
    shopId: null,
    now: new Date(),
  };

  let fresh;
  try {
    fresh = await buildJoinQueueDraft(ctx, action.shop_id, action.service_ids);
  } catch (err) {
    const code = err instanceof ProposalError ? err.code : "UNAVAILABLE";
    await settleFailed(supabase, actionId, code);
    return refuse(code);
  }

  // ---------------------------------------------------------------------
  // 3) The ordinary queue insert
  // ---------------------------------------------------------------------
  // `joinQueue` from @/lib/queue-join — the exact call the booking screen
  // makes, with this request's cookie-bound client. Not a privileged RPC, not
  // service-role, not a second implementation: the same row, the same
  // `serials: customer insert` policy, the same `serial_before_insert` trigger
  // computing the chair, the position, the snapshot and the amount.
  const { data: serial, error: insertError } = await joinQueue(supabase, {
    shopId: action.shop_id,
    serviceIds: action.service_ids,
    // From the session. There is no body field for this and no argument on any
    // tool — and RLS re-checks it against auth.uid() regardless.
    customerId: user.id,
    customerName: (user.user_metadata?.full_name as string | undefined) ?? "",
  });

  if (insertError || !serial) {
    // The queue refused it. Which refusal is recorded in the audit as a code,
    // and the customer gets the app's own sentence for it — the same one the
    // booking screen would have shown, from `translateDbError`, so a closed
    // shop reads the same however they arrived at it.
    const friendly = translateDbError(insertError);
    await settleFailed(supabase, actionId, "QUEUE_REFUSED");
    return refuse(
      "QUEUE_REFUSED",
      409,
      friendly.message || REFUSAL_MESSAGES.QUEUE_REFUSED,
    );
  }

  // ---------------------------------------------------------------------
  // 4) Settle the audit row
  // ---------------------------------------------------------------------
  // The only place `EXECUTED` is written, and it needs the serial to do it.
  await supabase.rpc("ai_action_settle", {
    p_action_id: actionId,
    p_status: "EXECUTED",
    p_serial_id: serial.id,
    p_failure_code: null,
  });

  // Real figures from the real row. `position` and `total_amount` were computed
  // by the trigger; the wait is re-read from the live queue. Nothing here is
  // the proposal's stored copy, and nothing is invented — §38's rule against
  // inventing a queue position is satisfied structurally, because the position
  // is a column.
  return NextResponse.json(
    {
      ok: true,
      serial: {
        id: serial.id,
        position: serial.position,
        chairId: serial.chair_id,
        status: serial.status,
        totalTaka: serial.total_amount,
        estimatedStartAt: serial.estimated_start_at,
      },
      shop: { id: fresh.shopId, name: fresh.shopName },
      services: fresh.services.map((service) => ({
        name: service.name,
        priceTaka: service.priceTaka,
      })),
      estimatedWaitMin: fresh.estimatedWaitMin,
    },
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
    p_serial_id: null,
    p_failure_code: code,
  });
}

/**
 * Heal a CONFIRMED row whose settle was lost.
 *
 * Only called when the claim reported the proposal was already spent. If the
 * customer has an active serial at that shop, the earlier attempt's insert
 * landed — so the record is completed against it and the customer is told they
 * are in the queue, which is true.
 *
 * Returns null when there is no such serial, in which case the proposal really
 * is spent and the caller refuses normally. Deliberately narrow: it matches on
 * the shop AND an active status AND `auth.uid()`'s own rows (RLS would give it
 * nothing else), so it cannot attach an unrelated booking to an audit row.
 */
async function reconcile(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  actionId: string,
  userId: string,
): Promise<NextResponse | null> {
  const { data: action } = await supabase
    .from("ai_actions")
    .select("id, status, shop_id, serial_id")
    .eq("id", actionId)
    .maybeSingle();

  if (!action) return null;

  // Already settled — report the outcome it settled to rather than re-running.
  if (action.status === "EXECUTED") {
    return NextResponse.json(
      { ok: true, alreadyExecuted: true, serial: { id: action.serial_id } },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (action.status !== "CONFIRMED" || !action.shop_id) return null;

  const { data: serials } = await supabase
    .from("serials")
    .select("id, position, chair_id, status, total_amount, estimated_start_at")
    .eq("customer_id", userId)
    .eq("shop_id", action.shop_id)
    .in("status", ["WAITING", "IN_PROGRESS"])
    .limit(1);

  const serial = (serials ?? [])[0];
  if (!serial) return null;

  await supabase.rpc("ai_action_settle", {
    p_action_id: actionId,
    p_status: "EXECUTED",
    p_serial_id: serial.id,
    p_failure_code: null,
  });

  return NextResponse.json(
    {
      ok: true,
      alreadyExecuted: true,
      serial: {
        id: serial.id,
        position: serial.position,
        chairId: serial.chair_id,
        status: serial.status,
        totalTaka: serial.total_amount,
        estimatedStartAt: serial.estimated_start_at,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
